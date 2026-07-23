exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER trg_waitlist_updated_at
    BEFORE UPDATE ON waitlist
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `);

  pgm.sql(`
    CREATE TRIGGER trg_site_content_updated_at
    BEFORE UPDATE ON site_content
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP TRIGGER IF EXISTS trg_site_content_updated_at ON site_content;");
  pgm.sql("DROP TRIGGER IF EXISTS trg_waitlist_updated_at ON waitlist;");
  pgm.sql("DROP FUNCTION IF EXISTS set_updated_at();");
};
