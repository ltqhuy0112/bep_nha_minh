import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

type Rule = {
  scope: string;
  directory: string;
  forbidden: RegExp[];
};

const rules: Rule[] = [
  {
    scope: "apps/api must not import frontend code",
    directory: "apps/api/src",
    forbidden: [
      /from\s+["']@\//,
      /from\s+["'][^"']*apps\/web\/src/,
      /from\s+["'][^"']*apps\\web\\src/
    ]
  },
  {
    scope: "packages/shared must stay pure",
    directory: "packages/shared/src",
    forbidden: [
      /from\s+["']@\//,
      /from\s+["']@bep-nha-minh\/api/,
      /from\s+["'][^"']*apps\/(api|web)\//,
      /from\s+["'](next|react|react-dom|pg|server-only)(\/[^"']*)?["']/
    ]
  },
  {
    scope: "client components must not import backend package",
    directory: "apps/web/src",
    forbidden: []
  }
];

async function listSourceFiles(directory: string): Promise<string[]> {
  const absoluteDirectory = path.join(root, directory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".next" || entry.name === "node_modules") return [];
        return listSourceFiles(entryPath);
      }

      return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    })
  );

  return files.flat();
}

function isClientComponent(source: string) {
  return /^\s*["']use client["'];/.test(source);
}

async function verifyRule(rule: Rule) {
  const failures: string[] = [];
  const files = await listSourceFiles(rule.directory);

  for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    const forbidden =
      rule.scope === "client components must not import backend package" &&
      isClientComponent(source)
        ? [/from\s+["']@bep-nha-minh\/api/]
        : rule.forbidden;

    for (const pattern of forbidden) {
      if (pattern.test(source)) {
        failures.push(`${file} violates "${rule.scope}" with ${pattern}`);
      }
    }
  }

  return failures;
}

async function main() {
  const failures = (await Promise.all(rules.map(verifyRule))).flat();

  if (failures.length > 0) {
    console.error("Source boundary check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Source boundary check passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error.";
  console.error(`Source boundary check failed: ${message}`);
  process.exit(1);
});
