# Enterprise Identity & RBAC Audit Engine – Project Documentation

DBMS Experiential Learning – Level 3 | Dept. of CSE, PES University | Faculty: Dr. Nagasundari S
Team: R. Pooja (PES2UG24CS388), Priyanka Reddy (PES2UG24CS378)

## 1. Objectives
1. Model an enterprise's organisations, departments, users, roles, permissions and policies in a normalised relational schema.
2. Decide "may user X do ACTION on RESOURCE?" inside the database (role grants plus deny-policy overrides) so every client gets the same answer.
3. Record every sensitive event in an append-only audit trail that cannot be edited or deleted, and archive old entries with checksums.
4. Store high-volume, variable-shape access/login events in MongoDB and mine them with aggregation pipelines (denial hot-spots, brute-force detection).
5. Provide a Next.js console with authentication and role-based screens for administrators and auditors.

Real-world problem: companies must prove who had access to what and detect misuse (SOX, ISO 27001 style audits). The project goes beyond CRUD with a decision engine, separation-of-duties enforcement, policy overrides, immutable logging, archiving and analytics.

## 2. Functional requirements
| ID | Requirement |
|---|---|
| F1 | Users sign in with username and password; failed attempts are logged; sessions can be revoked |
| F2 | Admin creates users and activates/deactivates them (deactivation closes open sessions) |
| F3 | Admin assigns and revokes roles; ADMIN and AUDITOR may not be held by one person; a user keeps at least one role |
| F4 | Any user can test their own access; ADMIN/AUDITOR can test anyone (what-if) |
| F5 | Policy deny rules override role grants; admin can enable/disable rules |
| F6 | Auditor/Admin search and filter the audit trail (full-text, result, date range) |
| F7 | Admin archives audit entries older than N days (idempotent, checksummed) |
| F8 | Dashboard shows SQL statistics and MongoDB analytics |
| F9 | Role-based UI and API: ADMIN, AUDITOR, and other roles (4+ roles in total) |

## 3. ER diagram
The hand-drawn ER diagram and relational schema from the mini-project submission are included in the final report (insert as images). Summary of entities and relationships:

| Relationship | Cardinality | Implemented as |
|---|---|---|
| organization HAS department | 1 : N | `department.org_id` FK (CASCADE) |
| organization HAS organization (parent) | 1 : N (recursive) | `organization.parent_org_id` FK (SET NULL) |
| department HAS department (parent) | 1 : N (recursive) | `department.parent_dept_id` FK |
| organization HAS user_account | 1 : N | `user_account.org_id` FK |
| department BELONGS TO user_account | 1 : N | `user_account.dept_id` FK |
| user_account ASSIGNED role | M : N | associative table `user_role` |
| role REFERS permission | M : N | associative table `role_permission` |
| user_account HAS session | 1 : N | `session.user_id` FK |
| session GENERATES audit_log | 1 : N | `audit_log.session_id` FK (SET NULL) |
| policy HAS policy_rule | 1 : N | `policy_rule.policy_id` FK |
| policy_rule EVALUATED BY audit_log | 1 : N | `audit_log.policy_rule_id` FK (SET NULL) |
| audit_log ARCHIVED TO audit_archive | 1 : 1 | `audit_archive.audit_id` UNIQUE FK |

Changes made to the original design while building the application (update the ER diagram to match):
`user_account.email`, `user_account.password_hash` (login), `user_role.assigned_by` (accountability), `audit_log.user_id` (actor) and `audit_log.details` (searchable text).

## 4. Relational schema
```
organization(org_id PK, org_name, org_code UNIQUE, parent_org_id FK->organization, status, created_at)
department(dept_id PK, org_id FK->organization, dept_name, parent_dept_id FK->department, status, created_at)
user_account(user_id PK, username UNIQUE, email UNIQUE, password_hash, org_id FK, dept_id FK, status, created_at)
role(role_id PK, role_name UNIQUE, description, scope_type, status, created_at)
user_role(user_role_id PK, user_id FK, role_id FK, status, assigned_at, assigned_by FK->user_account, UNIQUE(user_id, role_id))
permission(permission_id PK, permission_name UNIQUE, description, action, resource, status, created_at)
role_permission(role_permission_id PK, role_id FK, permission_id FK, status, assigned_at, UNIQUE(role_id, permission_id))
session(session_id PK, user_id FK, ip_address, user_agent, login_time, logout_time, status)
policy(policy_id PK, policy_name UNIQUE, status, description, created_at)
policy_rule(policy_rule_id PK, policy_id FK, rule_name, status, action, effect, resource, rule_condition)
audit_log(audit_id PK, session_id FK, user_id FK, policy_rule_id FK, action, resource, resource_id, result, ip_address, timestamp, details)
audit_archive(archive_id PK, audit_id FK UNIQUE, archived_at, archive_location, checksum)
```
Normal form: all tables are in 3NF. Many-to-many links use associative tables with surrogate keys and a UNIQUE pair; `audit_log` deliberately keeps no copies of user/role names, so renames cannot make history inconsistent.

## 5. Database choice and justification
| Data | Store | Reason |
|---|---|---|
| Users, roles, permissions, policies, sessions, audit_log | **MySQL** | Highly relational; needs foreign keys, CHECK constraints, ACID transactions (role changes must be all-or-nothing), triggers (separation of duties, immutability) and joins for the permission lookup |
| Access/login events (who asked, decision, matched rules, IP, context) | **MongoDB** | Append-heavy; each event carries a different `context` shape (login vs access check); queried by aggregation (group by resource/user/IP/day), not by joins; TTL index expires data automatically; adding fields needs no schema migration |

The audit_log in MySQL is the legal record (immutable, transactional). MongoDB holds the analytics copy of events. If MongoDB is down, the application keeps working (`logEvent` swallows the failure, the dashboard shows a notice).
A vector database was not used: there is no unstructured text to embed, and the guidelines ask that every database be justified by the data rather than added for show.

## 6. Data dictionary
Types and constraints are in `db/01_schema.sql` and `db/02_alter.sql`. Key rules enforced by the database:

| Table.column | Rule |
|---|---|
| user_account.username | UNIQUE, CHECK length >= 3 |
| user_account.email | UNIQUE, CHECK matches `x@y.zz` pattern (nullable) |
| user_account.status | CHECK in ACTIVE / INACTIVE / LOCKED |
| user_role | UNIQUE(user_id, role_id); status CHECK ACTIVE / INACTIVE; trigger blocks ADMIN + AUDITOR together |
| session.status | CHECK ACTIVE / CLOSED / EXPIRED |
| policy_rule.effect | CHECK ALLOW / DENY |
| audit_log.result | CHECK ALLOW / DENY / SUCCESS / FAILURE; UPDATE and DELETE blocked by triggers |
| audit_archive.audit_id | UNIQUE (an entry is archived once) |
| All FKs | ON UPDATE CASCADE; ON DELETE chosen per relationship (CASCADE for owned children, SET NULL to keep history) |

MongoDB document (`rbac_audit.access_events`):
```json
{ "type": "ACCESS_CHECK | LOGIN_SUCCESS | LOGIN_FAILURE", "ts": ISODate, "userId": 3, "username": "manager1",
  "action": "EXPORT", "resource": "report", "decision": "DENY", "ip": "10.0.1.13",
  "context": { "reason": "...", "matchedRules": [{ "ruleId": 2, "effect": "DENY" }], "requestedBy": "admin" } }
```
Validator: `$jsonSchema` requires `type` and `ts`, restricts `type` and `decision` to allowed values. Indexes: TTL on `ts` (180 days), `{type, ts}`, `{userId, ts}`, `{resource, decision}`. Retrieval strategy: aggregation pipelines in `app/api/analytics/route.js`.

## 7. Database implementation
| Brief item | Where |
|---|---|
| CREATE, PK/FK, constraints, indexes | `db/01_schema.sql` |
| ALTER, DROP (index and table), CHECK, FULLTEXT index | `db/02_alter.sql` |
| Views | `v_user_effective_permissions`, `v_user_role_summary`, `v_denials_per_day` (`db/04_routines.sql`) |
| INSERT / UPDATE / DELETE / SELECT | seed script, API routes (users, roles, policies, sessions, audit) |
| JOIN, GROUP BY, HAVING, ORDER BY, aggregates, subqueries, recursive CTE | `db/05_queries.sql` Q1–Q10 |

### Advanced features (brief asks for at least four SQL and one NoSQL)
| # | Feature | Implementation |
|---|---|---|
| 1 | Transactions | `sp_assign_role`, `sp_archive_audit` (START TRANSACTION / COMMIT / ROLLBACK in an exit handler); app-level `withTx` for revoke, deactivate, policy toggle |
| 2 | Stored procedures | `sp_check_access` (decision engine), `sp_assign_role`, `sp_archive_audit` |
| 3 | Triggers | `trg_user_role_sod` (separation of duties), `trg_user_role_audit_ins/del` (automatic audit), `trg_audit_no_update/delete` (immutability) |
| 4 | Views | three views above, used by the API and the decision engine |
| 5 | Indexing | FK indexes, composite `(resource, result)` and `(user_id, timestamp)` |
| 6 | Full-text search | `FULLTEXT ft_audit_search (action, resource, details)` queried with `MATCH ... AGAINST` in the audit page |
| 7 | NoSQL aggregation | four MongoDB pipelines: by resource ($group with $cond), top denied users, brute-force detection ($group then $match), daily trend ($dateToString) |

### Decision algorithm (`sp_check_access`)
1. User missing or not ACTIVE: DENY.
2. Look for a matching permission in `v_user_effective_permissions` (active user, role, role-permission and permission). None: DENY.
3. Look for an active DENY rule in an active policy that matches the action and resource, unless its condition `EXCEPT_ROLE:<NAME>` exempts a role the user holds. Found: DENY with the rule id.
4. Otherwise ALLOW.
5. Always write the decision to `audit_log` and return `decision, reason, rule_id`.

## 8. Important queries
See `db/05_queries.sql`: Q1 effective permissions (JOIN over 4 tables), Q2 multi-role users (GROUP BY/HAVING), Q3 permissions per role (LEFT JOIN + aggregate), Q4 users without roles (subquery), Q5 dormant accounts, Q6 department hierarchy (recursive CTE), Q7 most-denied resources, Q8 policy rules that fired, Q9 full-text search, Q10 archive coverage, Q11 calling the engine. Paste outputs into the final report.

## 9. System architecture
```
Browser (Next.js pages: React client components)
   |  fetch + httpOnly JWT cookie
   v
Next.js Route Handlers  (app/api/*)       middleware.js redirects unauthenticated page requests
   |  guard(): verify JWT -> check session row ACTIVE -> check role
   |-----------------------------|
   v                             v
MySQL access_control_db          MongoDB rbac_audit.access_events
(system of record: tables,       (event analytics: validator, TTL,
 views, procedures, triggers)     aggregation pipelines)
```
Security: credentials only in `.env.local`; passwords hashed with bcrypt; all SQL uses parameter placeholders; the app connects as a user with DML and EXECUTE rights only (no DDL); sessions are server-side revocable; errors from constraints are mapped to safe messages.

Roles and access: ADMIN (everything), AUDITOR (read-only users, roles, audit, policies, analytics), all other roles (own profile, own access checks).

## 10. Application screenshots (capture for the final report)
1. Login; 2. Overview for admin (stats, Mongo tables, brute-force alert); 3. Overview for emp1 (own permissions); 4. Users & roles with a rejected ADMIN+AUDITOR assignment; 5. Access check showing DENY by policy rule; 6. Audit trail with full-text search; 7. Archive confirmation; 8. Policies page; 9. MySQL `SHOW TABLES`/`DESCRIBE`; 10. mongosh `getIndexes()` and an aggregation result; 11. GitHub commit graph with both members.

## 11. Testing results
Run the SQL tests with `mysql --force -u root -p < db/06_tests.sql` and compare with the expected result written beside each statement (T1–T19). Application tests (password for demo users is in README):

| ID | Test | Expected |
|---|---|---|
| A1 | Sign in as admin | 200, cookie set, session row ACTIVE, LOGIN audit row |
| A2 | Sign in with wrong password | 401, `LOGIN_FAILED` row in audit_log, `LOGIN_FAILURE` document in Mongo |
| A3 | Sign in as inactive `emp3` | 401 |
| A4 | emp1 calls `GET /api/users` | 403 |
| A5 | No cookie: open `/dashboard` and call `/api/users` | redirect to /login; 401 |
| A6 | Create user with short password / duplicate username / bad e-mail | 400 / 409 / 400 (database CHECK) |
| A7 | Assign AUDITOR to admin | 422 "Separation of duties violation" |
| A8 | Assign MANAGER to emp1 | success, `ROLE_ASSIGNED` audit row written by trigger |
| A9 | Revoke a user's only role | 422 "A user must keep at least one role" |
| A10 | Deactivate emp2 while signed in elsewhere | emp2's next request returns 401 |
| A11 | emp1: READ profile | ALLOW |
| A12 | emp1: READ audit_log | DENY (no permission) |
| A13 | manager1 (as admin what-if): EXPORT report | DENY by policy rule 2 |
| A14 | Enable rule 3, then admin archives audit entries | 403 "Archive blocked ... policy rule #3"; disable rule 3 restores access |
| A15 | Audit search `+payroll +denied` | only matching rows |
| A16 | Archive 90 days twice | first returns n > 0, second returns 0 |
| A17 | Stop MongoDB, reload dashboard | SQL statistics still load, warning shown, sign-in still works |
| A18 | auditor1 tries to toggle a policy rule or archive | 403 |

Record actual outputs and screenshots in this table before submission.

## 12. Originality and limits
The schema and engine are designed for this project; no tutorial or repository was copied. Known limits (mention honestly in the viva): rule conditions support only `EXCEPT_ROLE`; ALLOW-effect rules are stored but not evaluated; the "archive" records location and checksum in `audit_archive` but does not move data to external storage; rate limiting of login attempts is detected (Mongo alert) but not enforced.

## 13. Conclusion
The system combines a constraint-rich MySQL core (transactions, procedures, triggers, views, full-text search) with a MongoDB event store for analytics, behind an authenticated Next.js interface. Each database is used for the data it suits, and integrity rules live in the database so that no application path can bypass them.
