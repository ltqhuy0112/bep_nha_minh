exports.up = (pgm) => {
  pgm.createTable("waitlist", {
    id: {
      type: "uuid",
      primaryKey: true,
      notNull: true,
      default: pgm.func("gen_random_uuid()")
    },
    name: { type: "varchar(120)", notNull: true },
    phone: { type: "varchar(30)" },
    email: { type: "varchar(255)" },
    district: { type: "varchar(120)", notNull: true },
    preferred_meal: { type: "varchar(80)" },
    source: { type: "varchar(80)", notNull: true, default: "website" },
    status: { type: "varchar(30)", notNull: true, default: "new" },
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
};

exports.down = (pgm) => {
  pgm.dropTable("waitlist");
};
