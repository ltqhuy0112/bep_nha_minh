import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { locationSource } from "./source";

async function main() {
  const response = await fetch(locationSource.url, { signal: AbortSignal.timeout(30000), redirect: "error" });
  if (!response.ok) throw new Error("Location download failed");
  const raw = await response.text();
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || data.length !== 34 || !data.every((p) => Array.isArray(p.Wards))) throw new Error("Unexpected location dataset");
  const license = await fetch(locationSource.licenseUrl, { signal: AbortSignal.timeout(30000), redirect: "error" });
  if (!license.ok) throw new Error("License download failed");
  await mkdir(locationSource.directory, { recursive: true });
  await writeFile(`${locationSource.directory}/vietnam.json`, raw);
  await writeFile(`${locationSource.directory}/LICENSE`, await license.text());
  await writeFile(`${locationSource.directory}/manifest.json`, JSON.stringify({
    revision: locationSource.revision, sourceUrl: locationSource.url, sha256: createHash("sha256").update(raw).digest("hex"),
    provinces: data.length, wards: data.reduce((total, p) => total + p.Wards.length, 0),
  }, null, 2) + "\n");
  console.log("Downloaded pinned location data and license; review and commit the dataset before syncing.");
}
void main().catch(() => { console.error("Location download failed; no database changes made."); process.exitCode = 1; });
