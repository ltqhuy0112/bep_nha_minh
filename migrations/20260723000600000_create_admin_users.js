exports.up = (pgm) => {
  pgm.createTable("admin_users", {
    id: {
      type: "uuid",
      primaryKey: true,
      notNull: true,
      default: pgm.func("gen_random_uuid()")
    },
    email: { type: "varchar(255)", notNull: true },
    password_hash: { type: "varchar(255)", notNull: true },
    name: { type: "varchar(120)", notNull: true },
    role: { type: "varchar(40)", notNull: true, default: "VIEWER" },
    is_active: { type: "boolean", notNull: true, default: true },
    last_login_at: { type: "timestamptz" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  pgm.addConstraint(
    "admin_users",
    "admin_users_role_check",
    "CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'ORDER_MANAGER', 'VIEWER'))"
  );

  pgm.createIndex("admin_users", "email", {
    name: "idx_admin_users_email_unique",
    unique: true
  });
  pgm.createIndex("admin_users", "role", { name: "idx_admin_users_role" });
  pgm.createIndex("admin_users", "is_active", {
    name: "idx_admin_users_is_active"
  });

  pgm.createTable("admin_login_attempts", {
    id: {
      type: "uuid",
      primaryKey: true,
      notNull: true,
      default: pgm.func("gen_random_uuid()")
    },
    email: { type: "varchar(255)", notNull: true },
    attempted_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    },
    success: { type: "boolean", notNull: true, default: false },
    failure_reason: { type: "varchar(80)" },
    ip_address: { type: "inet" },
    user_agent: { type: "text" }
  });

  pgm.createIndex("admin_login_attempts", ["email", "attempted_at"], {
    name: "idx_admin_login_attempts_email_attempted_at"
  });
  pgm.createIndex("admin_login_attempts", "attempted_at", {
    name: "idx_admin_login_attempts_attempted_at"
  });

  pgm.sql(`
    CREATE TRIGGER trg_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON admin_users;");
  pgm.dropIndex("admin_login_attempts", "attempted_at", {
    name: "idx_admin_login_attempts_attempted_at",
    ifExists: true
  });
  pgm.dropIndex("admin_login_attempts", ["email", "attempted_at"], {
    name: "idx_admin_login_attempts_email_attempted_at",
    ifExists: true
  });
  pgm.dropTable("admin_login_attempts");
  pgm.dropIndex("admin_users", "is_active", {
    name: "idx_admin_users_is_active",
    ifExists: true
  });
  pgm.dropIndex("admin_users", "role", {
    name: "idx_admin_users_role",
    ifExists: true
  });
  pgm.dropIndex("admin_users", "email", {
    name: "idx_admin_users_email_unique",
    ifExists: true
  });
  pgm.dropTable("admin_users");
};
