-- =====================================================================
-- 04_routines.sql  |  Views, stored procedures, triggers
-- Run with the mysql client (it understands DELIMITER).
-- =====================================================================
USE access_control_db;

-- ---------- VIEWS ----------
CREATE OR REPLACE VIEW v_user_effective_permissions AS
SELECT u.user_id, u.username, r.role_id, r.role_name,
       p.permission_id, p.permission_name, p.action, p.resource
FROM user_account u
JOIN user_role ur       ON ur.user_id = u.user_id AND ur.status = 'ACTIVE'
JOIN role r             ON r.role_id = ur.role_id AND r.status = 'ACTIVE'
JOIN role_permission rp ON rp.role_id = r.role_id AND rp.status = 'ACTIVE'
JOIN permission p       ON p.permission_id = rp.permission_id AND p.status = 'ACTIVE'
WHERE u.status = 'ACTIVE';

CREATE OR REPLACE VIEW v_user_role_summary AS
SELECT u.user_id, u.username, u.email, u.status, o.org_name, d.dept_name,
       COALESCE(GROUP_CONCAT(DISTINCT r.role_name ORDER BY r.role_name SEPARATOR ', '), '') AS roles,
       COALESCE(GROUP_CONCAT(DISTINCT r.role_id ORDER BY r.role_id), '')                    AS role_ids,
       COUNT(DISTINCT r.role_id) AS role_count
FROM user_account u
JOIN organization o      ON o.org_id = u.org_id
LEFT JOIN department d   ON d.dept_id = u.dept_id
LEFT JOIN user_role ur   ON ur.user_id = u.user_id AND ur.status = 'ACTIVE'
LEFT JOIN role r         ON r.role_id = ur.role_id
GROUP BY u.user_id, u.username, u.email, u.status, o.org_name, d.dept_name;

CREATE OR REPLACE VIEW v_denials_per_day AS
SELECT DATE(timestamp) AS day, COUNT(*) AS denials
FROM audit_log WHERE result = 'DENY'
GROUP BY DATE(timestamp);

-- ---------- PROCEDURES & TRIGGERS ----------
DELIMITER $$

-- Access decision engine: RBAC grant, then policy DENY override, then audit.
DROP PROCEDURE IF EXISTS sp_check_access$$
CREATE PROCEDURE sp_check_access(
  IN p_user_id BIGINT UNSIGNED, IN p_action VARCHAR(50), IN p_resource VARCHAR(100),
  IN p_session_id BIGINT UNSIGNED, IN p_ip VARCHAR(45))
BEGIN
  DECLARE v_decision VARCHAR(10) DEFAULT 'DENY';
  DECLARE v_reason   VARCHAR(255) DEFAULT 'No matching permission';
  DECLARE v_rule_id  BIGINT UNSIGNED DEFAULT NULL;
  DECLARE v_exists   INT DEFAULT 0;
  DECLARE v_active   INT DEFAULT 0;

  SELECT COUNT(*) INTO v_exists FROM user_account WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_active FROM user_account WHERE user_id = p_user_id AND status = 'ACTIVE';

  IF v_active = 0 THEN
    SET v_reason = 'User not found or not active';
  ELSEIF EXISTS (SELECT 1 FROM v_user_effective_permissions
                 WHERE user_id = p_user_id AND action = p_action AND resource = p_resource) THEN
    SELECT pr.policy_rule_id INTO v_rule_id
    FROM policy_rule pr JOIN policy p ON p.policy_id = pr.policy_id
    WHERE pr.status = 'ACTIVE' AND p.status = 'ACTIVE' AND pr.effect = 'DENY'
      AND pr.action = p_action AND (pr.resource IS NULL OR pr.resource = p_resource)
      AND NOT (COALESCE(pr.rule_condition,'') LIKE 'EXCEPT_ROLE:%' AND EXISTS (
            SELECT 1 FROM user_role ur JOIN role r ON r.role_id = ur.role_id
            WHERE ur.user_id = p_user_id AND ur.status = 'ACTIVE' AND r.status = 'ACTIVE'
              AND r.role_name = SUBSTRING(pr.rule_condition, 13)))
    ORDER BY pr.policy_rule_id LIMIT 1;

    IF v_rule_id IS NULL THEN
      SET v_decision = 'ALLOW', v_reason = 'Granted by role permission';
    ELSE
      SET v_reason = CONCAT('Denied by policy rule #', v_rule_id);
    END IF;
  END IF;

  INSERT INTO audit_log (session_id, user_id, policy_rule_id, action, resource, result, ip_address, details)
  VALUES (p_session_id, IF(v_exists > 0, p_user_id, NULL), v_rule_id, 'ACCESS_CHECK',
          p_resource, v_decision, p_ip, CONCAT(p_action, ' ', p_resource, ': ', v_reason));

  SELECT v_decision AS decision, v_reason AS reason, v_rule_id AS rule_id;
END$$

-- Transactional role assignment with validation
DROP PROCEDURE IF EXISTS sp_assign_role$$
CREATE PROCEDURE sp_assign_role(
  IN p_user_id BIGINT UNSIGNED, IN p_role_id BIGINT UNSIGNED, IN p_actor_id BIGINT UNSIGNED)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
    IF NOT EXISTS (SELECT 1 FROM user_account WHERE user_id = p_user_id AND status = 'ACTIVE') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Target user does not exist or is not active';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM role WHERE role_id = p_role_id AND status = 'ACTIVE') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Role does not exist or is not active';
    END IF;
    IF EXISTS (SELECT 1 FROM user_role WHERE user_id = p_user_id AND role_id = p_role_id) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User already holds this role';
    END IF;
    INSERT INTO user_role (user_id, role_id, assigned_by) VALUES (p_user_id, p_role_id, p_actor_id);
  COMMIT;
  SELECT 'OK' AS result;
END$$

-- Archive audit rows older than p_days (idempotent; records checksum per row)
DROP PROCEDURE IF EXISTS sp_archive_audit$$
CREATE PROCEDURE sp_archive_audit(IN p_days INT, IN p_actor_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_count INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  IF p_days IS NULL OR p_days < 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'p_days must be at least 1';
  END IF;
  START TRANSACTION;
    INSERT INTO audit_archive (audit_id, archive_location, checksum)
    SELECT a.audit_id,
           CONCAT('cold-storage/audit/', DATE_FORMAT(a.timestamp, '%Y-%m'), '.log'),
           SHA2(CONCAT_WS('|', a.audit_id, a.user_id, a.action, a.resource, a.result, a.timestamp), 256)
    FROM audit_log a LEFT JOIN audit_archive x ON x.audit_id = a.audit_id
    WHERE x.audit_id IS NULL AND a.timestamp < NOW() - INTERVAL p_days DAY;
    SET v_count = ROW_COUNT();
    INSERT INTO audit_log (user_id, action, resource, result, details)
    VALUES (p_actor_id, 'AUDIT_ARCHIVED', 'audit_log', 'SUCCESS',
            CONCAT(v_count, ' entries older than ', p_days, ' days archived'));
  COMMIT;
  SELECT v_count AS archived;
END$$

-- Separation of duties: ADMIN and AUDITOR must never be held by the same user
DROP TRIGGER IF EXISTS trg_user_role_sod$$
CREATE TRIGGER trg_user_role_sod BEFORE INSERT ON user_role FOR EACH ROW
BEGIN
  IF (SELECT role_name FROM role WHERE role_id = NEW.role_id) IN ('ADMIN','AUDITOR')
     AND EXISTS (SELECT 1 FROM user_role ur JOIN role r ON r.role_id = ur.role_id
                 WHERE ur.user_id = NEW.user_id AND ur.status = 'ACTIVE'
                   AND r.role_name IN ('ADMIN','AUDITOR') AND r.role_id <> NEW.role_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Separation of duties violation: ADMIN and AUDITOR cannot be held by one user';
  END IF;
END$$

-- Audit every role change automatically
DROP TRIGGER IF EXISTS trg_user_role_audit_ins$$
CREATE TRIGGER trg_user_role_audit_ins AFTER INSERT ON user_role FOR EACH ROW
BEGIN
  INSERT INTO audit_log (user_id, action, resource, resource_id, result, details)
  VALUES (NEW.assigned_by, 'ROLE_ASSIGNED', 'user_role', NEW.user_id, 'SUCCESS',
          CONCAT('role_id=', NEW.role_id, ' assigned to user_id=', NEW.user_id));
END$$

DROP TRIGGER IF EXISTS trg_user_role_audit_del$$
CREATE TRIGGER trg_user_role_audit_del AFTER DELETE ON user_role FOR EACH ROW
BEGIN
  INSERT INTO audit_log (user_id, action, resource, resource_id, result, details)
  VALUES (@actor_id, 'ROLE_REVOKED', 'user_role', OLD.user_id, 'SUCCESS',
          CONCAT('role_id=', OLD.role_id, ' revoked from user_id=', OLD.user_id));
END$$

-- Audit log is append-only
DROP TRIGGER IF EXISTS trg_audit_no_update$$
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_log FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is immutable: UPDATE not allowed';
END$$

DROP TRIGGER IF EXISTS trg_audit_no_delete$$
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_log FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is immutable: DELETE not allowed';
END$$

DELIMITER ;
