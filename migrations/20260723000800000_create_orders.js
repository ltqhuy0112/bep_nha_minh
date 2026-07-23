exports.up = (pgm) => {
  pgm.createTable("orders", {
    id: {
      type: "uuid",
      primaryKey: true,
      notNull: true,
      default: pgm.func("gen_random_uuid()")
    },
    order_code: { type: "varchar(30)", notNull: true, unique: true },
    customer_id: {
      type: "uuid",
      notNull: true,
      references: "customers(id)",
      onDelete: "RESTRICT"
    },
    status: { type: "varchar(30)", notNull: true, default: "PENDING" },
    fulfillment_type: {
      type: "varchar(30)",
      notNull: true,
      default: "DELIVERY"
    },
    delivery_date: { type: "date" },
    delivery_time_slot: { type: "varchar(80)" },
    subtotal_amount: { type: "integer", notNull: true, default: 0 },
    delivery_fee: { type: "integer", notNull: true, default: 0 },
    discount_amount: { type: "integer", notNull: true, default: 0 },
    total_amount: { type: "integer", notNull: true },
    currency: { type: "char(3)", notNull: true, default: "VND" },
    customer_note: { type: "text" },
    internal_note: { type: "text" },
    approved_at: { type: "timestamptz" },
    approved_by: {
      type: "uuid",
      references: "admin_users(id)",
      onDelete: "SET NULL"
    },
    rejected_at: { type: "timestamptz" },
    rejected_by: {
      type: "uuid",
      references: "admin_users(id)",
      onDelete: "SET NULL"
    },
    rejection_reason: { type: "text" },
    cancelled_at: { type: "timestamptz" },
    cancelled_by: {
      type: "uuid",
      references: "admin_users(id)",
      onDelete: "SET NULL"
    },
    cancellation_reason: { type: "text" },
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
    "orders",
    "orders_status_check",
    "CHECK (status IN ('PENDING', 'APPROVED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'REJECTED', 'CANCELLED'))"
  );
  pgm.addConstraint(
    "orders",
    "orders_fulfillment_type_check",
    "CHECK (fulfillment_type IN ('DELIVERY', 'PICKUP'))"
  );
  pgm.addConstraint(
    "orders",
    "orders_currency_check",
    "CHECK (currency = 'VND')"
  );
  pgm.addConstraint(
    "orders",
    "orders_amounts_non_negative_check",
    "CHECK (subtotal_amount >= 0 AND delivery_fee >= 0 AND discount_amount >= 0 AND total_amount >= 0)"
  );
  pgm.addConstraint(
    "orders",
    "orders_total_amount_check",
    "CHECK (total_amount = subtotal_amount + delivery_fee - discount_amount)"
  );
  pgm.addConstraint(
    "orders",
    "orders_rejection_reason_check",
    "CHECK (status <> 'REJECTED' OR rejection_reason IS NOT NULL)"
  );
  pgm.addConstraint(
    "orders",
    "orders_cancellation_reason_check",
    "CHECK (status <> 'CANCELLED' OR cancellation_reason IS NOT NULL)"
  );

  pgm.createIndex("orders", "created_at", { name: "idx_orders_created_at" });
  pgm.createIndex("orders", "status", { name: "idx_orders_status" });
  pgm.createIndex("orders", "customer_id", { name: "idx_orders_customer_id" });
  pgm.createIndex("orders", "delivery_date", {
    name: "idx_orders_delivery_date",
    where: "delivery_date IS NOT NULL"
  });
  pgm.createIndex("orders", ["status", "delivery_date"], {
    name: "idx_orders_status_delivery_date"
  });

  pgm.sql(`
    CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;");
  pgm.dropIndex("orders", ["status", "delivery_date"], {
    name: "idx_orders_status_delivery_date",
    ifExists: true
  });
  pgm.dropIndex("orders", "delivery_date", {
    name: "idx_orders_delivery_date",
    ifExists: true
  });
  pgm.dropIndex("orders", "customer_id", {
    name: "idx_orders_customer_id",
    ifExists: true
  });
  pgm.dropIndex("orders", "status", {
    name: "idx_orders_status",
    ifExists: true
  });
  pgm.dropIndex("orders", "created_at", {
    name: "idx_orders_created_at",
    ifExists: true
  });
  pgm.dropTable("orders");
};
