import { builtinModules } from "node:module";
import { featureOwner, inspectSource, localImportPath } from "./source-imports";

type Module = ReturnType<typeof inspectSource>;
const serverPackages = new Set(["server-only", "next/headers", "next/server", "pg", ...builtinModules]);

export function graphViolations(sources: Map<string, string>) {
  const modules = new Map<string, Module>();
  for (const [file, source] of sources) modules.set(file.replaceAll("\\", "/"), inspectSource(file, source));
  function resolve(file: string, specifier: string) {
    const base = localImportPath(file, specifier).replace(/\.(js|jsx)$/, "");
    return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((candidate) => modules.has(candidate));
  }
  const failures: string[] = [];
  const features = new Map<string, Set<string>>();
  for (const [file, module] of modules) {
    const owner = featureOwner(file);
    if (!owner) continue;
    const edges = features.get(owner) ?? new Set<string>();
    features.set(owner, edges);
    for (const specifier of module.imports) {
      const dependency = featureOwner(localImportPath(file, specifier));
      if (dependency && dependency !== owner) edges.add(dependency);
    }
  }
  function cycle(owner: string, chain: string[], visited: Set<string>): string[] | undefined {
    if (chain.includes(owner)) return [...chain.slice(chain.indexOf(owner)), owner];
    if (visited.has(owner)) return;
    visited.add(owner);
    for (const next of features.get(owner) ?? []) {
      const found = cycle(next, [...chain, owner], visited);
      if (found) return found;
    }
  }
  for (const owner of features.keys()) {
    const found = cycle(owner, [], new Set());
    if (found) failures.push(`Feature cycle: ${found.join(" -> ")}`);
  }
  function serverPath(file: string, visited: Set<string>): string[] | undefined {
    if (visited.has(file)) return;
    visited.add(file);
    // Next.js replaces module-level Server Action imports with server references.
    if (modules.get(file)?.serverAction && !modules.get(file)?.client) return;
    for (const specifier of modules.get(file)?.runtimeImports ?? []) {
      if (serverPackages.has(specifier) || specifier.startsWith("node:") ||
          localImportPath(file, specifier).startsWith("apps/api/src/")) return [file, specifier];
      const target = resolve(file, specifier);
      const found = target && serverPath(target, visited);
      if (found) return [file, ...found];
    }
  }
  for (const [file, module] of modules) {
    if (!module.client) continue;
    const found = serverPath(file, new Set());
    if (found) failures.push(`Client reaches server-only module: ${found.join(" -> ")}`);
  }
  return failures;
}
