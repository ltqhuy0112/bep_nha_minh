exports.up = (pgm) => {
  pgm.createTable("order_status_history", {
    id: {
      type: "uuid",
      primaryKey: true,
      notNull: true,
      default: pgm.func("gen_random_uuid()")
    },
    order_id: {
      type: "uuid",
      notNull: true,
      references: "orders(id)",
      onDelete: "CASCADE"
    },
    from_status: { type: "varchar(30)" },
    to_status: { type: "varchar(30)", notNull: true },
    reason: { type: "text" },
    changed_by: {
      type: "uuid",
      references: "admin_users(id)",
      onDelete: "SET NULL"
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  pgm.addConstraint(
    "order_status_history",
    "order_status_history_from_status_check",
    "CHECK (from_status IS NULL OR from_status IN ('PENDING', 'APPROVED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'REJECTED', 'CANCELLED'))"
  );
  pgm.addConstraint(
    "order_status_history",
    "order_status_history_to_status_check",
    "CHECK (to_status IN ('PENDING', 'APPROVED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'REJECTED', 'CANCELLED'))"
  );
  pgm.addConstraint(
    "order_status_history",
    "order_status_history_status_changed_check",
    "CHECK (from_status IS NULL OR from_status <> to_status)"
  );

  pgm.createIndex("order_status_history", "order_id", {
    name: "idx_order_status_history_order_id"
  });
  pgm.createIndex("order_status_history", "created_at", {
    name: "idx_order_status_history_created_at"
  });
  pgm.createIndex("order_status_history", ["order_id", "created_at"], {
    name: "idx_order_status_history_order_id_created_at"
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("order_status_history", ["order_id", "created_at"], {
    name: "idx_order_status_history_order_id_created_at",
    ifExists: true
  });
  pgm.dropIndex("order_status_history", "created_at", {
    name: "idx_order_status_history_created_at",
    ifExists: true
  });
  pgm.dropIndex("order_status_history", "order_id", {
    name: "idx_order_status_history_order_id",
    ifExists: true
  });
  pgm.dropTable("order_status_history");
};
