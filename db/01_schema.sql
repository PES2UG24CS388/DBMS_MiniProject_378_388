-- =====================================================================
-- 01_schema.sql  |  DDL: base schema (matches the mini-project PDF)
-- Enterprise Identity & RBAC Audit Engine  |  MySQL 8.0.16+
-- =====================================================================
CREATE DATABASE IF NOT EXISTS access_control_db;
USE access_control_db;

CREATE TABLE organization (
  org_id        BIGINT UNSIGNED AUTO_INCREMENT,
  org_name      VARCHAR(150) NOT NULL,
  org_code      VARCHAR(50)  NOT NULL,
  parent_org_id BIGINT UNSIGNED NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (org_id),
  UNIQUE KEY uq_organization_code (org_code),
  CONSTRAINT fk_organization_parent FOREIGN KEY (parent_org_id)
    REFERENCES organization(org_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE department (
  dept_id        BIGINT UNSIGNED AUTO_INCREMENT,
  org_id         BIGINT UNSIGNED NOT NULL,
  dept_name      VARCHAR(150) NOT NULL,
  parent_dept_id BIGINT UNSIGNED NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (dept_id),
  CONSTRAINT fk_department_organization FOREIGN KEY (org_id)
    REFERENCES organization(org_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_department_parent FOREIGN KEY (parent_dept_id)
    REFERENCES department(dept_id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_department_org (org_id),
  INDEX idx_department_parent (parent_dept_id)
) ENGINE=InnoDB;

CREATE TABLE user_account (
  user_id    BIGINT UNSIGNED AUTO_INCREMENT,
  username   VARCHAR(100) NOT NULL,
  org_id     BIGINT UNSIGNED NOT NULL,
  dept_id    BIGINT UNSIGNED NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_username (username),
  CONSTRAINT fk_user_organization FOREIGN KEY (org_id)
    REFERENCES organization(org_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_department FOREIGN KEY (dept_id)
    REFERENCES department(dept_id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_user_org (org_id),
  INDEX idx_user_dept (dept_id)
) ENGINE=InnoDB;

CREATE TABLE role (
  role_id     BIGINT UNSIGNED AUTO_INCREMENT,
  role_name   VARCHAR(100) NOT NULL,
  description TEXT,
  scope_type  VARCHAR(50),
  status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_role_name (role_name)
) ENGINE=InnoDB;

CREATE TABLE user_role (
  user_role_id BIGINT UNSIGNED AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  role_id      BIGINT UNSIGNED NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  assigned_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_role_id),
  UNIQUE KEY uq_user_role (user_id, role_id),
  CONSTRAINT fk_user_role_user FOREIGN KEY (user_id)
    REFERENCES user_account(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_role_role FOREIGN KEY (role_id)
    REFERENCES role(role_id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_user_role_user (user_id),
  INDEX idx_user_role_role (role_id)
) ENGINE=InnoDB;

CREATE TABLE permission (
  permission_id   BIGINT UNSIGNED AUTO_INCREMENT,
  permission_name VARCHAR(100) NOT NULL,
  description     TEXT,
  action          VARCHAR(50)  NOT NULL,
  resource        VARCHAR(100) NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (permission_id),
  UNIQUE KEY uq_permission_name (permission_name),
  INDEX idx_permission_resource (resource),
  INDEX idx_permission_action (action)
) ENGINE=InnoDB;

CREATE TABLE role_permission (
  role_permission_id BIGINT UNSIGNED AUTO_INCREMENT,
  role_id            BIGINT UNSIGNED NOT NULL,
  permission_id      BIGINT UNSIGNED NOT NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  assigned_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_permission_id),
  UNIQUE KEY uq_role_permission (role_id, permission_id),
  CONSTRAINT fk_role_permission_role FOREIGN KEY (role_id)
    REFERENCES role(role_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_role_permission_permission FOREIGN KEY (permission_id)
    REFERENCES permission(permission_id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_role_permission_role (role_id),
  INDEX idx_role_permission_permission (permission_id)
) ENGINE=InnoDB;

CREATE TABLE session (
  session_id  BIGINT UNSIGNED AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  ip_address  VARCHAR(45),
  user_agent  VARCHAR(500),
  login_time  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logout_time DATETIME NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (session_id),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id)
    REFERENCES user_account(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_session_user (user_id),
  INDEX idx_session_login_time (login_time),
  INDEX idx_session_status (status)
) ENGINE=InnoDB;

CREATE TABLE policy (
  policy_id   BIGINT UNSIGNED AUTO_INCREMENT,
  policy_name VARCHAR(150) NOT NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  description TEXT,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (policy_id),
  UNIQUE KEY uq_policy_name (policy_name)
) ENGINE=InnoDB;

CREATE TABLE policy_rule (
  policy_rule_id BIGINT UNSIGNED AUTO_INCREMENT,
  policy_id      BIGINT UNSIGNED NOT NULL,
  rule_name      VARCHAR(150) NOT NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  action         VARCHAR(50)  NOT NULL,
  effect         VARCHAR(20)  NOT NULL,
  resource       VARCHAR(100),
  rule_condition TEXT,
  PRIMARY KEY (policy_rule_id),
  CONSTRAINT fk_policy_rule_policy FOREIGN KEY (policy_id)
    REFERENCES policy(policy_id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_policy_rule_policy (policy_id),
  INDEX idx_policy_rule_status (status)
) ENGINE=InnoDB;

CREATE TABLE audit_log (
  audit_id       BIGINT UNSIGNED AUTO_INCREMENT,
  session_id     BIGINT UNSIGNED NULL,
  policy_rule_id BIGINT UNSIGNED NULL,
  action         VARCHAR(100) NOT NULL,
  resource       VARCHAR(100),
  resource_id    VARCHAR(100),
  result         VARCHAR(50),
  ip_address     VARCHAR(45),
  timestamp      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_id),
  CONSTRAINT fk_audit_log_session FOREIGN KEY (session_id)
    REFERENCES session(session_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_audit_log_policy_rule FOREIGN KEY (policy_rule_id)
    REFERENCES policy_rule(policy_rule_id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_audit_session (session_id),
  INDEX idx_audit_policy_rule (policy_rule_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_timestamp (timestamp),
  INDEX idx_audit_resource (resource)
) ENGINE=InnoDB;

CREATE TABLE audit_archive (
  archive_id       BIGINT UNSIGNED AUTO_INCREMENT,
  audit_id         BIGINT UNSIGNED NOT NULL,
  archived_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archive_location VARCHAR(500) NOT NULL,
  checksum         VARCHAR(255),
  PRIMARY KEY (archive_id),
  UNIQUE KEY uq_archive_audit (audit_id),
  CONSTRAINT fk_audit_archive_audit FOREIGN KEY (audit_id)
    REFERENCES audit_log(audit_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
