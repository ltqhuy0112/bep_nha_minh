import ts from "typescript";
import path from "node:path";

export function inspectSource(file: string, source: string) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  const runtimeImports: string[] = [];
  let client = false;
  let serverAction = false;
  for (const statement of tree.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    if (statement.expression.text === "use client") client = true;
    if (statement.expression.text === "use server") serverAction = true;
  }
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
      const typeOnly = ts.isImportDeclaration(node)
        ? node.importClause?.isTypeOnly || (node.importClause?.namedBindings &&
          ts.isNamedImports(node.importClause.namedBindings) && !node.importClause.name &&
          node.importClause.namedBindings.elements.length > 0 &&
          node.importClause.namedBindings.elements.every((element) => element.isTypeOnly))
        : node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause) &&
          node.exportClause.elements.length > 0 && node.exportClause.elements.every((element) => element.isTypeOnly));
      if (!typeOnly) runtimeImports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
        node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      imports.push(node.arguments[0].text);
      runtimeImports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return { imports, runtimeImports, client, serverAction };
}

export function localImportPath(file: string, specifier: string) {
  if (specifier.startsWith("@/")) return path.posix.normalize(`apps/web/src/${specifier.slice(2)}`);
  if (specifier.startsWith("@bep-nha-minh/api/")) return `apps/api/src/${specifier.slice(18)}`;
  if (specifier.startsWith("@bep-nha-minh/shared/")) return `packages/shared/src/${specifier.slice(21)}`;
  if (specifier.startsWith(".")) return path.posix.normalize(path.posix.join(path.posix.dirname(file.replaceAll("\\", "/")), specifier));
  return specifier;
}

export function featureOwner(file: string) {
  return /^apps\/web\/src\/features\/([^/]+)\//.exec(file)?.[1];
}

export function publicBoundaryViolations(file: string, imports: string[]) {
  const normalized = file.replaceAll("\\", "/");
  const publicPage = normalized.startsWith("apps/web/src/app/[locale]/");
  const feature = normalized.startsWith("apps/web/src/features/");
  return imports.filter((specifier) => {
    if ((publicPage || feature) && specifier.startsWith("@bep-nha-minh/api")) return true;
    const target = localImportPath(normalized, specifier).replace(/\.(ts|tsx|js|jsx)$/, "");
    const owner = featureOwner(normalized);
    const dependency = featureOwner(target);
    if (!owner || !dependency || owner === dependency) return false;
    if (owner === "cart" && dependency === "catalog") return true;
    if (target !== `apps/web/src/features/${dependency}/public`) return true;
    return !new Set(["catalog->cart", "cart->customer-auth", "customer-addresses->customer-auth"]).has(`${owner}->${dependency}`);
  });
}
