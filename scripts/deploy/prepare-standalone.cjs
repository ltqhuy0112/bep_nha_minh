const { cpSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");
const web = resolve(__dirname, "../../apps/web");
const standalone = resolve(web, ".next/standalone/apps/web");
if (!existsSync(standalone)) throw new Error("Next standalone output was not produced.");
for (const directory of ["public", ".next/static"]) {
  const source = resolve(web, directory);
  if (existsSync(source)) cpSync(source, resolve(standalone, directory), { recursive: true, force: true });
}
