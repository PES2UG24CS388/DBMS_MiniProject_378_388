-- =====================================================================
-- 06_tests.sql  |  SQL test cases. Run with:  mysql --force -u root -p < db/06_tests.sql
-- (--force keeps going after the *expected* errors.)  Expected result in comments.
-- =====================================================================
USE access_control_db;

-- T1 duplicate username                -> ERROR 1062 Duplicate entry
INSERT INTO user_account (username, org_id) VALUES ('admin', 1);
-- T2 invalid status                    -> ERROR 3819 Check constraint chk_user_status violated
INSERT INTO user_account (username, org_id, status) VALUES ('tester1', 1, 'BANNED');
-- T3 malformed e-mail                  -> ERROR 3819 chk_user_email
INSERT INTO user_account (username, email, org_id) VALUES ('tester2', 'not-an-email', 1);
-- T4 FK violation (org 999)            -> ERROR 1452
INSERT INTO user_account (username, org_id) VALUES ('tester3', 999);
-- T5 short username                    -> ERROR 3819 chk_user_username
INSERT INTO user_account (username, org_id) VALUES ('ab', 1);

-- T6 separation of duties trigger      -> ERROR 1644 Separation of duties violation
CALL sp_assign_role(1, 2, 1);
-- T7 assign to inactive user           -> ERROR 1644 Target user does not exist or is not active
CALL sp_assign_role(7, 3, 1);
-- T8 duplicate role                    -> ERROR 1644 User already holds this role
CALL sp_assign_role(5, 4, 1);
-- T9 valid assignment                  -> result OK, plus ROLE_ASSIGNED row in audit_log
CALL sp_assign_role(5, 3, 1);
SELECT action, details FROM audit_log WHERE action = 'ROLE_ASSIGNED' ORDER BY audit_id DESC LIMIT 1;

-- T10-T14 access engine
CALL sp_check_access(5, 'READ',    'profile',   NULL, '127.0.0.1'); -- ALLOW
CALL sp_check_access(5, 'READ',    'audit_log', NULL, '127.0.0.1'); -- DENY  (no permission)
CALL sp_check_access(3, 'EXPORT',  'report',    NULL, '127.0.0.1'); -- DENY  (policy rule #2)
CALL sp_check_access(4, 'UPDATE',  'payroll',   NULL, '127.0.0.1'); -- ALLOW (HR_STAFF exception)
CALL sp_check_access(7, 'READ',    'profile',   NULL, '127.0.0.1'); -- DENY  (inactive user)

-- T15 immutability                     -> ERROR 1644 audit_log is immutable
UPDATE audit_log SET result = 'ALLOW' WHERE audit_id = 4;
-- T16                                  -> ERROR 1644
DELETE FROM audit_log WHERE audit_id = 1;

-- T17 archive is idempotent            -> first call archived > 0, second call 0
CALL sp_archive_audit(90, 1);
CALL sp_archive_audit(90, 1);

-- T18 CASCADE inside a rolled-back transaction -> user_role rows for role 5 vanish, then return
START TRANSACTION;
  SET @actor_id = 1;
  DELETE FROM role WHERE role_id = 5;
  SELECT COUNT(*) AS rows_for_role5_after_delete FROM user_role WHERE role_id = 5;  -- 0
ROLLBACK;
SELECT COUNT(*) AS rows_for_role5_after_rollback FROM user_role WHERE role_id = 5;  -- 1

-- T19 full-text search                 -> returns the DENY rows mentioning payroll
SELECT audit_id, details FROM audit_log WHERE MATCH(action, resource, details) AGAINST ('payroll' IN NATURAL LANGUAGE MODE);
