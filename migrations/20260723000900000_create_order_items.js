exports.up = (pgm) => {
  pgm.createTable("order_items", {
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
    item_name: { type: "varchar(180)", notNull: true },
    item_snapshot: { type: "jsonb" },
    quantity: { type: "integer", notNull: true },
    unit_price: { type: "integer", notNull: true },
    line_total: { type: "integer", notNull: true },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  pgm.addConstraint(
    "order_items",
    "order_items_quantity_positive_check",
    "CHECK (quantity > 0)"
  );
  pgm.addConstraint(
    "order_items",
    "order_items_unit_price_non_negative_check",
    "CHECK (unit_price >= 0)"
  );
  pgm.addConstraint(
    "order_items",
    "order_items_line_total_check",
    "CHECK (line_total = quantity * unit_price)"
  );

  pgm.createIndex("order_items", "order_id", {
    name: "idx_order_items_order_id"
  });
  pgm.createIndex("order_items", "created_at", {
    name: "idx_order_items_created_at"
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("order_items", "created_at", {
    name: "idx_order_items_created_at",
    ifExists: true
  });
  pgm.dropIndex("order_items", "order_id", {
    name: "idx_order_items_order_id",
    ifExists: true
  });
  pgm.dropTable("order_items");
};
