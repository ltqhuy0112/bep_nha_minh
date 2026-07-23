require("dotenv/config");

const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh";

const cliPath = resolve(
  __dirname,
  "../../node_modules/node-pg-migrate/bin/node-pg-migrate.js"
);
const args = process.argv.slice(2);
const normalizedArgs = args.includes("create")
  ? args
  : [...args, "--migration-filename-format", "utc", "--no-check-order"];

const result = spawnSync(process.execPath, [cliPath, ...normalizedArgs], {
  stdio: "inherit",
  env: process.env
});

process.exit(result.status ?? 1);
