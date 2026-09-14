import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { inspectSource, publicBoundaryViolations } from "./source-imports";
import { graphViolations } from "./source-graph";

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

async function verifyRule(rule: Rule) {
  const failures: string[] = [];
  const files = await listSourceFiles(rule.directory);

  for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    const inspected = inspectSource(file, source);
    const importSource = inspected.imports.map((specifier) => `from "${specifier}"`).join("\n");
    const forbidden =
      rule.scope === "client components must not import backend package" &&
      inspected.client
        ? [/from\s+["']@bep-nha-minh\/api/]
        : rule.forbidden;

    for (const pattern of forbidden) {
      if (pattern.test(importSource)) {
        failures.push(`${file} violates "${rule.scope}" with ${pattern}`);
      }
    }
    if (rule.directory === "apps/web/src") {
      for (const specifier of publicBoundaryViolations(file, inspected.imports)) {
        failures.push(`${file} crosses a public module boundary: ${specifier}`);
      }
    }
  }

  return failures;
}

async function main() {
  const failures = (await Promise.all(rules.map(verifyRule))).flat();
  const sources = new Map<string, string>();
  for (const rule of rules) {
    for (const file of await listSourceFiles(rule.directory)) {
      sources.set(file, await readFile(path.join(root, file), "utf8"));
    }
  }
  failures.push(...graphViolations(sources));

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
