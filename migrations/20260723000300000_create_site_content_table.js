exports.up = (pgm) => {
  pgm.createTable("site_content", {
    id: {
      type: "uuid",
      primaryKey: true,
      notNull: true,
      default: pgm.func("gen_random_uuid()")
    },
    section_key: { type: "varchar(120)", notNull: true, unique: true },
    content_json: { type: "jsonb", notNull: true },
    is_published: { type: "boolean", notNull: true, default: true },
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
  pgm.dropTable("site_content");
};
