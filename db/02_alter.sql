-- =====================================================================
-- 02_alter.sql  |  ALTER / DROP / CHECK constraints / extra indexes
-- Adds what the application needs on top of the base schema.
-- =====================================================================
USE access_control_db;

-- Credentials + e-mail for login (ER diagram has email; DDL did not)
ALTER TABLE user_account
  ADD COLUMN email         VARCHAR(150) NULL AFTER username,
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER email,
  ADD UNIQUE KEY uq_user_email (email),
  ADD CONSTRAINT chk_user_status CHECK (status IN ('ACTIVE','INACTIVE','LOCKED')),
  ADD CONSTRAINT chk_user_email  CHECK (email IS NULL OR email LIKE '%_@_%.__%'),
  ADD CONSTRAINT chk_user_username CHECK (CHAR_LENGTH(username) >= 3);

-- Who granted the role (ER diagram: assigned_by)
ALTER TABLE user_role
  ADD COLUMN assigned_by BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_user_role_assigned_by FOREIGN KEY (assigned_by)
    REFERENCES user_account(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT chk_user_role_status CHECK (status IN ('ACTIVE','INACTIVE'));

-- Actor + free-text details on audit entries (ER diagram: user_id, details)
ALTER TABLE audit_log
  ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER session_id,
  ADD COLUMN details TEXT NULL,
  ADD CONSTRAINT fk_audit_log_user FOREIGN KEY (user_id)
    REFERENCES user_account(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT chk_audit_result
    CHECK (result IS NULL OR result IN ('ALLOW','DENY','SUCCESS','FAILURE'));

-- Domain constraints on the remaining tables
ALTER TABLE organization    ADD CONSTRAINT chk_org_status     CHECK (status IN ('ACTIVE','INACTIVE'));
ALTER TABLE department      ADD CONSTRAINT chk_dept_status    CHECK (status IN ('ACTIVE','INACTIVE'));
ALTER TABLE role            ADD CONSTRAINT chk_role_status    CHECK (status IN ('ACTIVE','INACTIVE'));
ALTER TABLE permission      ADD CONSTRAINT chk_perm_status    CHECK (status IN ('ACTIVE','INACTIVE'));
ALTER TABLE role_permission ADD CONSTRAINT chk_rp_status      CHECK (status IN ('ACTIVE','INACTIVE'));
ALTER TABLE policy          ADD CONSTRAINT chk_policy_status  CHECK (status IN ('ACTIVE','INACTIVE'));
ALTER TABLE session         ADD CONSTRAINT chk_session_status CHECK (status IN ('ACTIVE','CLOSED','EXPIRED'));
ALTER TABLE policy_rule
  ADD CONSTRAINT chk_rule_status CHECK (status IN ('ACTIVE','INACTIVE')),
  ADD CONSTRAINT chk_rule_effect CHECK (effect IN ('ALLOW','DENY'));

-- Full-text search over audit entries
CREATE FULLTEXT INDEX ft_audit_search ON audit_log (action, resource, details);

-- DROP demo: replace a single-column index with better composite ones
DROP INDEX idx_audit_resource ON audit_log;
CREATE INDEX idx_audit_resource_result ON audit_log (resource, result);
CREATE INDEX idx_audit_user_time       ON audit_log (user_id, timestamp);

-- DROP TABLE demo (scratch table created and removed)
CREATE TABLE tmp_ddl_demo (id INT PRIMARY KEY);
DROP TABLE tmp_ddl_demo;
