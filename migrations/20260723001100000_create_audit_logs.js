exports.up = (pgm) => {
  pgm.createTable("audit_logs", {
    id: {
      type: "uuid",
      primaryKey: true,
      notNull: true,
      default: pgm.func("gen_random_uuid()")
    },
    actor_admin_id: {
      type: "uuid",
      references: "admin_users(id)",
      onDelete: "SET NULL"
    },
    action: { type: "varchar(120)", notNull: true },
    entity_type: { type: "varchar(80)", notNull: true },
    entity_id: { type: "uuid" },
    metadata: { type: "jsonb" },
    ip_address: { type: "varchar(80)" },
    user_agent: { type: "text" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  pgm.addConstraint(
    "audit_logs",
    "audit_logs_action_not_blank_check",
    "CHECK (length(trim(action)) > 0)"
  );
  pgm.addConstraint(
    "audit_logs",
    "audit_logs_entity_type_not_blank_check",
    "CHECK (length(trim(entity_type)) > 0)"
  );

  pgm.createIndex("audit_logs", "actor_admin_id", {
    name: "idx_audit_logs_actor_admin_id",
    where: "actor_admin_id IS NOT NULL"
  });
  pgm.createIndex("audit_logs", "created_at", {
    name: "idx_audit_logs_created_at"
  });
  pgm.createIndex("audit_logs", ["entity_type", "entity_id"], {
    name: "idx_audit_logs_entity_type_entity_id",
    where: "entity_id IS NOT NULL"
  });
  pgm.createIndex("audit_logs", "action", {
    name: "idx_audit_logs_action"
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("audit_logs", "action", {
    name: "idx_audit_logs_action",
    ifExists: true
  });
  pgm.dropIndex("audit_logs", ["entity_type", "entity_id"], {
    name: "idx_audit_logs_entity_type_entity_id",
    ifExists: true
  });
  pgm.dropIndex("audit_logs", "created_at", {
    name: "idx_audit_logs_created_at",
    ifExists: true
  });
  pgm.dropIndex("audit_logs", "actor_admin_id", {
    name: "idx_audit_logs_actor_admin_id",
    ifExists: true
  });
  pgm.dropTable("audit_logs");
};
