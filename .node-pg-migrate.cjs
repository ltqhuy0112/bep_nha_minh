require("dotenv/config");

module.exports = {
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh",
  dir: "migrations",
  direction: "up",
  migrationsTable: "pgmigrations"
};
