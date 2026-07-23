# MCP And Tooling

## CodeGraph

Use when `.codegraph/` exists and the task requires code understanding, symbol tracing, call paths, or blast radius.

Preferred:

1. Use `tool_search` for `codegraph_explore` if the MCP tool is deferred.
2. Call `codegraph_explore` with `projectPath` set to the repo path.
3. Shell fallback:

```powershell
rtk codegraph explore "question, symbol, or file"
```

Do not run indexing automatically. If the index is missing or stale, tell the user they can run `codegraph init` or refresh outside the task.

## Context7

Use for current docs before changing APIs or configuration for:

- Next.js
- React
- Tailwind CSS
- Docker Compose
- PostgreSQL client libraries
- `node-pg-migrate`
- Zod
- Motion

Resolve the library first, then query specific docs.

## RTK

Prefix shell commands with `rtk`.

PowerShell cmdlets require:

```powershell
rtk proxy powershell -NoProfile -Command "Get-ChildItem"
```

Avoid noisy chained commands. Prefer parallel reads with `multi_tool_use.parallel`.

## Installing More MCP Or Plugins

Use `tool_search` to discover relevant Plugin Management tools when the user asks to install/connect/remove MCP/plugin capabilities.

Rules:

- Do not install broad or ambiguous plugins without asking for the exact target.
- Use Plugin Management for install/uninstall, not direct filesystem edits.
- Prefer official docs or primary sources for configuration.
- Explain capability gaps briefly when no matching MCP/tool is available.
