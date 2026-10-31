-- =====================================================================
-- 03_seed.sql  |  Sample data (fresh database; explicit IDs on purpose)
-- Passwords are set by `npm run seed:passwords` (bcrypt) - not stored here.
-- =====================================================================
USE access_control_db;

INSERT INTO organization (org_id, org_name, org_code, parent_org_id) VALUES
 (1,'PES Technologies Pvt Ltd','PESTECH',NULL),
 (2,'PES Labs','PESLAB',1);

INSERT INTO department (dept_id, org_id, dept_name, parent_dept_id) VALUES
 (1,1,'Engineering',NULL),
 (2,1,'Human Resources',NULL),
 (3,1,'Security & Compliance',NULL),
 (4,1,'Backend Team',1),
 (5,1,'Finance',NULL);

INSERT INTO user_account (user_id, username, email, org_id, dept_id, status) VALUES
 (1,'admin',   'admin@pestech.example',   1,3,'ACTIVE'),
 (2,'auditor1','auditor1@pestech.example',1,3,'ACTIVE'),
 (3,'manager1','manager1@pestech.example',1,1,'ACTIVE'),
 (4,'hr1',     'hr1@pestech.example',     1,2,'ACTIVE'),
 (5,'emp1',    'emp1@pestech.example',    1,4,'ACTIVE'),
 (6,'emp2',    'emp2@pestech.example',    2,1,'ACTIVE'),
 (7,'emp3',    'emp3@pestech.example',    1,5,'INACTIVE');

INSERT INTO role (role_id, role_name, description, scope_type) VALUES
 (1,'ADMIN',   'Manages users, roles, policies and archives','GLOBAL'),
 (2,'AUDITOR', 'Read-only access to audit trail and reports','GLOBAL'),
 (3,'MANAGER', 'Department manager: reports and team visibility','DEPARTMENT'),
 (4,'EMPLOYEE','Standard employee: own profile only','ORGANIZATION'),
 (5,'HR_STAFF','Handles payroll and employee records','DEPARTMENT');

INSERT INTO permission (permission_id, permission_name, description, action, resource) VALUES
 (1,'USER_READ','View user accounts','READ','user'),
 (2,'USER_CREATE','Create user accounts','CREATE','user'),
 (3,'USER_UPDATE','Modify user accounts','UPDATE','user'),
 (4,'ROLE_READ','View roles','READ','role'),
 (5,'ROLE_ASSIGN','Assign or revoke roles','ASSIGN','role'),
 (6,'AUDIT_READ','Read the audit trail','READ','audit_log'),
 (7,'AUDIT_ARCHIVE','Archive old audit entries','ARCHIVE','audit_log'),
 (8,'POLICY_READ','View policies','READ','policy'),
 (9,'POLICY_UPDATE','Enable or disable policy rules','UPDATE','policy'),
 (10,'REPORT_VIEW','View reports','READ','report'),
 (11,'PAYROLL_READ','View payroll','READ','payroll'),
 (12,'PAYROLL_UPDATE','Edit payroll','UPDATE','payroll'),
 (13,'PROFILE_READ','View own profile','READ','profile'),
 (14,'EXPORT_DATA','Export report data','EXPORT','report');

INSERT INTO role_permission (role_id, permission_id) VALUES
 (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8),(1,9),(1,10),(1,13),
 (2,1),(2,4),(2,6),(2,8),(2,10),(2,13),(2,14),
 (3,1),(3,10),(3,13),(3,14),
 (4,13),
 (5,1),(5,11),(5,12),(5,13);

INSERT INTO user_role (user_id, role_id, assigned_by) VALUES
 (1,1,1),(2,2,1),(3,3,1),(3,4,1),(4,5,1),(4,4,1),(5,4,1),(6,4,1),(7,4,1);

INSERT INTO policy (policy_id, policy_name, status, description) VALUES
 (1,'Sensitive Data Protection','ACTIVE','Restricts payroll edits and data exports'),
 (2,'Audit Trail Freeze','ACTIVE','Optional freeze on archiving the audit trail');

-- Condition syntax understood by sp_check_access: EXCEPT_ROLE:<ROLE_NAME>
INSERT INTO policy_rule (policy_rule_id, policy_id, rule_name, status, action, effect, resource, rule_condition) VALUES
 (1,1,'Only HR may edit payroll','ACTIVE','UPDATE','DENY','payroll','EXCEPT_ROLE:HR_STAFF'),
 (2,1,'Only auditors may export reports','ACTIVE','EXPORT','DENY','report','EXCEPT_ROLE:AUDITOR'),
 (3,2,'Nobody may archive audit logs','INACTIVE','ARCHIVE','DENY','audit_log',NULL);

-- Historical sessions (emp3 never logged in -> dormant-account query)
INSERT INTO session (session_id, user_id, ip_address, user_agent, login_time, logout_time, status) VALUES
 (1,1,'10.0.0.5','seed',NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY + INTERVAL 1 HOUR,'CLOSED'),
 (2,2,'10.0.0.8','seed',NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY + INTERVAL 1 HOUR,'CLOSED'),
 (3,3,'10.0.1.2','seed',NOW() - INTERVAL 40 DAY,NOW() - INTERVAL 40 DAY + INTERVAL 1 HOUR,'CLOSED'),
 (4,5,'10.0.2.9','seed',NOW() - INTERVAL 60 DAY,NOW() - INTERVAL 60 DAY + INTERVAL 1 HOUR,'CLOSED');

-- Historical audit rows (old ones feed the archive procedure demo)
INSERT INTO audit_log (session_id, user_id, policy_rule_id, action, resource, resource_id, result, ip_address, timestamp, details) VALUES
 (1,1,NULL,'LOGIN','session','1','SUCCESS','10.0.0.5',NOW() - INTERVAL 120 DAY,'Admin login'),
 (2,2,NULL,'ACCESS_CHECK','audit_log','6','ALLOW','10.0.0.8',NOW() - INTERVAL 110 DAY,'READ audit_log: Granted by role permission'),
 (3,3,2,'ACCESS_CHECK','report','14','DENY','10.0.1.2',NOW() - INTERVAL 100 DAY,'EXPORT report: Denied by policy rule #2'),
 (4,5,NULL,'ACCESS_CHECK','payroll','11','DENY','10.0.2.9',NOW() - INTERVAL 95 DAY,'READ payroll: No matching permission'),
 (1,1,NULL,'ROLE_ASSIGNED','user_role','2','SUCCESS','10.0.0.5',NOW() - INTERVAL 91 DAY,'AUDITOR role assigned to user 2'),
 (1,1,NULL,'ACCESS_CHECK','user','1','ALLOW','10.0.0.5',NOW() - INTERVAL 10 DAY,'READ user: Granted by role permission'),
 (2,2,NULL,'ACCESS_CHECK','policy','8','ALLOW','10.0.0.8',NOW() - INTERVAL 3 DAY,'READ policy: Granted by role permission'),
 (4,5,NULL,'ACCESS_CHECK','audit_log','6','DENY','10.0.2.9',NOW() - INTERVAL 1 DAY,'READ audit_log: No matching permission');
