import "dotenv/config";
import pg from "pg";
import { z } from "zod";
import {
  adminRoles,
  isAdminRole,
  type AdminRole
} from "@bep-nha-minh/api/lib/admin/permissions";
import {
  hashAdminPassword,
  validateAdminPassword
} from "@bep-nha-minh/api/lib/admin/password";

const { Pool } = pg;

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length > 0 ? valueParts.join("=") : "true"];
  })
);

const usage = `
Create an admin user for Bếp Nhà Mình.

Usage:
  npm run admin:create -- --email=adam.le@gmail.com --name="Adam Le" [--role=SUPER_ADMIN]

Options:
  --email=<email>          Required admin email.
  --name=<name>            Required display name.
  --role=<role>            SUPER_ADMIN, ADMIN, ORDER_MANAGER, or VIEWER.
  --update-existing        Update name, role, password and reactivate if email exists.
  --help                   Show this help text.

Password:
  Interactive terminals prompt without echo.
  Non-interactive runs can set ADMIN_PASSWORD.
`.trim();

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
  role: z
    .string()
    .trim()
    .default("SUPER_ADMIN")
    .refine(isAdminRole, {
      message: `Role must be one of: ${adminRoles.join(", ")}`
    })
    .transform((role) => role as AdminRole)
});

function promptHidden(label: string) {
  return new Promise<string>((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdin.setRawMode) {
      reject(new Error("Secure password prompt requires an interactive TTY."));
      return;
    }

    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = "";

    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stdout.write("\n");
    }

    function onData(key: string) {
      if (key === "\u0003") {
        cleanup();
        reject(new Error("Prompt cancelled."));
        return;
      }

      if (key === "\r" || key === "\n") {
        cleanup();
        resolve(value);
        return;
      }

      if (key === "\u0008" || key === "\u007f") {
        value = value.slice(0, -1);
        return;
      }

      value += key;
    }

    stdin.on("data", onData);
  });
}

async function getPassword() {
  const envPassword = process.env.ADMIN_PASSWORD;
  const argPassword = args.password;

  if (typeof argPassword === "string" && argPassword.length > 0) {
    return argPassword;
  }

  if (envPassword) {
    return envPassword;
  }

  const password = await promptHidden("Admin password: ");
  const confirmation = await promptHidden("Confirm password: ");

  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }

  return password;
}

async function main() {
  if (args.help === "true" || args.h === "true") {
    console.log(usage);
    return;
  }

  const parsed = inputSchema.parse({
    email: args.email,
    name: args.name,
    role: args.role
  });
  const updateExisting = args["update-existing"] === "true";

  const password = await getPassword();
  const passwordErrors = validateAdminPassword(password);
  if (passwordErrors.length > 0) {
    throw new Error(passwordErrors.join(" "));
  }

  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh";
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const existing = await pool.query(
      "SELECT id FROM admin_users WHERE email = $1 LIMIT 1",
      [parsed.email]
    );

    if (existing.rowCount && existing.rowCount > 0 && !updateExisting) {
      throw new Error("An admin user with this email already exists.");
    }

    const passwordHash = await hashAdminPassword(password);
    const result = updateExisting
      ? await pool.query<{ id: string; email: string; role: string }>(
          `
            INSERT INTO admin_users (email, password_hash, name, role, is_active)
            VALUES ($1, $2, $3, $4, true)
            ON CONFLICT (email)
            DO UPDATE SET
              password_hash = EXCLUDED.password_hash,
              name = EXCLUDED.name,
              role = EXCLUDED.role,
              is_active = true,
              updated_at = now()
            RETURNING id, email, role
          `,
          [parsed.email, passwordHash, parsed.name, parsed.role]
        )
      : await pool.query<{ id: string; email: string; role: string }>(
          `
            INSERT INTO admin_users (email, password_hash, name, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, email, role
          `,
          [parsed.email, passwordHash, parsed.name, parsed.role]
        );

    const admin = result.rows[0];
    console.log(
      `${updateExisting ? "Upserted" : "Created"} admin user ${admin.email} (${admin.role}).`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error.";
  console.error(`Failed to create admin user: ${message}`);
  process.exit(1);
});
