# Enterprise Identity & RBAC Audit Engine

DBMS Experiential Learning – Level 3 project (PES University, Dept. of CSE).
Team: R. Pooja (PES2UG24CS388) and Priyanka Reddy (PES2UG24CS378).

An access-control platform that answers "who can do what, who actually did it, and was it allowed?".
It manages organisations, users, roles and permissions, evaluates access requests against role grants
and deny policies, and keeps a tamper-resistant audit trail.

| Layer | Technology | Why |
|---|---|---|
| Relational store | MySQL 8 (`access_control_db`, 12 tables) | Users, roles, permissions and policies are strongly related and need constraints, transactions and triggers |
| NoSQL store | MongoDB (`rbac_audit.access_events`) | High-volume, variable-shape access/login events; aggregation pipelines for analytics; TTL expiry |
| Web + API | Next.js 14 (App Router, Route Handlers) | Required stack |
| Auth | bcrypt + JWT in an httpOnly cookie, session row in MySQL | Backend authentication, revocable sessions |

## Prerequisites
- Node.js 20.6 or newer
- MySQL 8.0.16 or newer (CHECK constraints are enforced from this version)
- MongoDB 6+ and `mongosh`
- Git

## Setup (about 10 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Create the database (run from the project root; enter your MySQL root password when asked)
mysql -u root -p < db/01_schema.sql
mysql -u root -p < db/02_alter.sql
mysql -u root -p < db/03_seed.sql
mysql -u root -p < db/04_routines.sql

# 3. Create a least-privilege application user (do NOT run the app as root)
mysql -u root -p -e "CREATE USER 'rbac_app'@'localhost' IDENTIFIED BY 'change_me';
  GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON access_control_db.* TO 'rbac_app'@'localhost';"

# 4. Create the MongoDB collection, validator, indexes and demo events
mongosh "mongodb://localhost:27017" mongo/init.js

# 5. Configure environment variables
cp .env.example .env.local        # Windows: copy .env.example .env.local
#    edit .env.local: set DB_PASSWORD (same as step 3) and a long random JWT_SECRET
#    DB_PORT is 3306 (the classic protocol), NOT 33060 (MySQL X protocol shown in mysqlsh)

# 6. Give every seeded user a bcrypt password (default: Passw0rd!)
npm run seed:passwords

# 7. Run
npm run dev        # http://localhost:3000
```

To start over: `mysql -u root -p < db/00_reset.sql`, then repeat steps 2, 3 (skip CREATE USER if it exists), 4 and 6.

## Demo accounts (password `Passw0rd!`)

| Username | Role(s) | What to try |
|---|---|---|
| `admin` | ADMIN | Create users, assign/revoke roles, disable policy rules, archive audit entries |
| `auditor1` | AUDITOR | Read-only: audit trail, users, policies, analytics |
| `manager1` | MANAGER, EMPLOYEE | Access check: `EXPORT report` is denied by a policy even though the role grants it |
| `hr1` | HR_STAFF, EMPLOYEE | `UPDATE payroll` is allowed through the policy exception |
| `emp1` | EMPLOYEE | Sees only own permissions; `/api/users` returns 403 |
| `emp3` | EMPLOYEE (inactive) | Cannot sign in |

## Project layout
```
db/        00_reset, 01_schema (DDL), 02_alter, 03_seed, 04_routines (views/procs/triggers), 05_queries, 06_tests
mongo/     init.js  (collection validator, indexes, demo data)
app/       Next.js pages (login, dashboard, users, access, audit, policies) and app/api/* route handlers
lib/       db.js (MySQL pool + transactions), mongo.js, auth.js (JWT + session guard), api.js (browser helper)
scripts/   seed-passwords.mjs
docs/      DOCUMENTATION.md (submission document), TEAM_PLAN.md (who does what + Git workflow)
```

## Running the tests
- SQL: `mysql --force -u root -p < db/06_tests.sql` (`--force` continues after the expected errors; compare with the comments in the file)
- API/UI: follow the test table in `docs/DOCUMENTATION.md`, section 11.
