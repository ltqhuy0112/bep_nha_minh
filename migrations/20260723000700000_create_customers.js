exports.up = (pgm) => {
  pgm.createTable("customers", {
    id: {
      type: "uuid",
      primaryKey: true,
      notNull: true,
      default: pgm.func("gen_random_uuid()")
    },
    full_name: { type: "varchar(120)", notNull: true },
    phone: { type: "varchar(30)" },
    email: { type: "varchar(255)" },
    address_line: { type: "text" },
    ward: { type: "varchar(120)" },
    district: { type: "varchar(120)" },
    city: { type: "varchar(120)" },
    notes: { type: "text" },
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
    "customers",
    "customers_contact_check",
    "CHECK (phone IS NOT NULL OR email IS NOT NULL)"
  );

  pgm.createIndex("customers", "phone", {
    name: "idx_customers_phone",
    where: "phone IS NOT NULL"
  });
  pgm.createIndex("customers", "email", {
    name: "idx_customers_email",
    where: "email IS NOT NULL"
  });
  pgm.createIndex("customers", "created_at", {
    name: "idx_customers_created_at"
  });

  pgm.sql(`
    CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;");
  pgm.dropIndex("customers", "created_at", {
    name: "idx_customers_created_at",
    ifExists: true
  });
  pgm.dropIndex("customers", "email", {
    name: "idx_customers_email",
    ifExists: true
  });
  pgm.dropIndex("customers", "phone", {
    name: "idx_customers_phone",
    ifExists: true
  });
  pgm.dropTable("customers");
};
