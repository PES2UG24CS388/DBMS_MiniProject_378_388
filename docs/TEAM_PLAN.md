# Team plan – two members, both on database and application

The brief requires each member to contribute to both database and application work, with commits
showing individual contribution. Work is split by **feature vertical**, so each person owns tables,
procedures, API routes and screens for their area.

## Member A – R. Pooja (PES2UG24CS388): Identity & Access Decisions
| Area | Deliverables |
|---|---|
| Database (MySQL) | `01_schema.sql` tables organization, department, user_account, role, user_role, permission, role_permission; `02_alter.sql` parts for user_account/user_role; views `v_user_effective_permissions`, `v_user_role_summary`; `sp_assign_role`; triggers `trg_user_role_sod`, `trg_user_role_audit_ins/del` |
| API | `auth/login`, `auth/logout`, `auth/me`, `users`, `users/[id]`, `users/[id]/roles`, `roles`; `lib/auth.js`, `middleware.js` |
| UI | Login, Users & roles page, shared Shell/navigation |
| Docs | Sections 1–3, 6 (identity part), data dictionary for her tables, ER diagram of identity side |
| Tests | SQL tests T1–T9; API tests A1–A9 |

## Member B – Priyanka Reddy (PES2UG24CS378): Policy, Audit & Analytics
| Area | Deliverables |
|---|---|
| Database (MySQL) | tables session, policy, policy_rule, audit_log, audit_archive; `02_alter.sql` parts for audit_log, FULLTEXT index, index changes; `sp_check_access`, `sp_archive_audit`; triggers `trg_audit_no_update/delete`; view `v_denials_per_day` |
| NoSQL (MongoDB) | `mongo/init.js` (validator, indexes, TTL, seed), `lib/mongo.js`, all aggregation pipelines in `api/analytics` |
| API | `access/check`, `audit`, `audit/archive`, `analytics`, `policies`, `policies/rules/[id]` |
| UI | Dashboard, Access check, Audit trail, Policies pages, `globals.css` |
| Docs | Sections 4 (NoSQL), 5, 7–9, important queries, testing results |
| Tests | SQL tests T10–T19; API tests A10–A18; MongoDB checks |

## Shared (do together, pair on one machine)
- Agree the final ER diagram and relational schema; update the hand-drawn ER with the added columns (email, password_hash, assigned_by, audit_log.user_id, details).
- `.env` handling, README, GitHub repository, the demo script, final screenshots, rehearsing the viva.
- Review each other's pull requests so both understand the whole system (viva questions can go to either person).

## Git workflow (so commits show individual work)
1. One repo `rbac-audit-engine`; Pooja creates it and adds Priyanka as collaborator. Add `.gitignore` first so `.env.local` is never committed.
2. `main` is protected by convention: nobody commits straight to it. Branches: `feat/identity-*` (Pooja), `feat/audit-*` (Priyanka).
3. Commit under your own `git config user.name/email`; small commits, message style `feat(users): assign role via stored procedure`.
4. Open a pull request per feature; the other person reviews and merges.
5. Suggested order and rough timeline:

| Day | Pooja | Priyanka |
|---|---|---|
| 1 | Schema + ALTER for her tables, seed users/roles | Schema + ALTER for her tables, seed policies/audit rows |
| 2 | Views, `sp_assign_role`, triggers | `sp_check_access`, `sp_archive_audit`, immutability triggers, FULLTEXT |
| 3 | Auth API + middleware + login page | MongoDB init + `logEvent`, access/check + audit APIs |
| 4 | Users/roles API and page | Analytics API, dashboard, audit + policies pages |
| 5 | Integration, SQL tests T1–T9, docs 1–3, 6 | Integration, SQL/API tests T10–T19, docs 4–5, 7–9 |
| 6 | Joint: screenshots, ER diagram update, documentation merge, demo rehearsal | same |
