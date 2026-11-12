-- =====================================================================
-- 05_queries.sql  |  Important queries for the demo / report
-- =====================================================================
USE access_control_db;

-- Q1 JOIN: every permission a user effectively holds
SELECT username, role_name, permission_name, action, resource
FROM v_user_effective_permissions WHERE username = 'manager1' ORDER BY permission_name;

-- Q2 GROUP BY + HAVING: users holding more than one active role
SELECT u.username, COUNT(*) AS roles_held
FROM user_account u JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'ACTIVE'
GROUP BY u.user_id, u.username HAVING COUNT(*) > 1 ORDER BY roles_held DESC;

-- Q3 Aggregate + ORDER BY: permissions per role (LEFT JOIN keeps empty roles)
SELECT r.role_name, COUNT(rp.permission_id) AS permission_count
FROM role r LEFT JOIN role_permission rp ON rp.role_id = r.role_id AND rp.status = 'ACTIVE'
GROUP BY r.role_id, r.role_name ORDER BY permission_count DESC;

-- Q4 Subquery: users with no role at all (orphan accounts)
SELECT username FROM user_account
WHERE user_id NOT IN (SELECT user_id FROM user_role WHERE status = 'ACTIVE');

-- Q5 Subquery: dormant accounts (no session in last 30 days)
SELECT u.username, u.status, MAX(s.login_time) AS last_login
FROM user_account u LEFT JOIN session s ON s.user_id = u.user_id
GROUP BY u.user_id, u.username, u.status
HAVING last_login IS NULL OR last_login < NOW() - INTERVAL 30 DAY;

-- Q6 Recursive CTE: department hierarchy
WITH RECURSIVE dept_tree AS (
  SELECT dept_id, dept_name, parent_dept_id, 0 AS depth, CAST(dept_name AS CHAR(500)) AS path
  FROM department WHERE parent_dept_id IS NULL
  UNION ALL
  SELECT d.dept_id, d.dept_name, d.parent_dept_id, t.depth + 1, CONCAT(t.path, ' > ', d.dept_name)
  FROM department d JOIN dept_tree t ON d.parent_dept_id = t.dept_id
)
SELECT * FROM dept_tree ORDER BY path;

-- Q7 Most-denied resources
SELECT resource, COUNT(*) AS denials FROM audit_log
WHERE result = 'DENY' GROUP BY resource ORDER BY denials DESC;

-- Q8 Policy rules that actually fired
SELECT pr.rule_name, pr.effect, COUNT(a.audit_id) AS times_triggered
FROM policy_rule pr LEFT JOIN audit_log a ON a.policy_rule_id = pr.policy_rule_id
GROUP BY pr.policy_rule_id, pr.rule_name, pr.effect;

-- Q9 Full-text search over the audit trail
SELECT audit_id, action, resource, result, details FROM audit_log
WHERE MATCH(action, resource, details) AGAINST ('+payroll +denied' IN BOOLEAN MODE);

-- Q10 Archive coverage
SELECT COUNT(*) AS total_entries, COUNT(x.audit_id) AS archived_entries
FROM audit_log a LEFT JOIN audit_archive x ON x.audit_id = a.audit_id;

-- Q11 Access decision (calls the engine; writes an audit row)
CALL sp_check_access(3, 'EXPORT', 'report', NULL, '127.0.0.1');   -- DENY by policy
CALL sp_check_access(2, 'EXPORT', 'report', NULL, '127.0.0.1');   -- ALLOW
