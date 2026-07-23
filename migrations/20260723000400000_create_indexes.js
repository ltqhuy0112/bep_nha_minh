exports.up = (pgm) => {
  pgm.createIndex("waitlist", "phone", {
    name: "idx_waitlist_phone",
    unique: true,
    where: "phone IS NOT NULL"
  });
  pgm.createIndex("waitlist", "email", {
    name: "idx_waitlist_email",
    unique: true,
    where: "email IS NOT NULL"
  });
  pgm.createIndex("waitlist", "status", { name: "idx_waitlist_status" });
  pgm.createIndex("waitlist", "created_at", { name: "idx_waitlist_created_at" });
  pgm.createIndex("site_content", "section_key", {
    name: "idx_site_content_section_key",
    unique: true
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("site_content", "section_key", {
    name: "idx_site_content_section_key",
    ifExists: true
  });
  pgm.dropIndex("waitlist", "created_at", {
    name: "idx_waitlist_created_at",
    ifExists: true
  });
  pgm.dropIndex("waitlist", "status", {
    name: "idx_waitlist_status",
    ifExists: true
  });
  pgm.dropIndex("waitlist", "email", {
    name: "idx_waitlist_email",
    ifExists: true
  });
  pgm.dropIndex("waitlist", "phone", {
    name: "idx_waitlist_phone",
    ifExists: true
  });
};
