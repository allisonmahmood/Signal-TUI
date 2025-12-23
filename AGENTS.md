# Agent Guidelines

## Commands

- `bun run src/ui/index.tsx` - Start the TUI application
- `bun test` - Run all tests
- `bun test <file>` - Run a single test file (e.g., `bun test src/core/MessageStorage.test.ts`)
- `bun install` - Install dependencies
- `bun run <script>` - Run npm scripts

## Bun Runtime Rules (from .cursor/rules/)

**Default to Bun, not Node.js:**
- Use `bun <file>` instead of `node` or `ts-node`
- Use `bun install` instead of `npm/pnpm/yarn install`
- Use `bun build` instead of `webpack`/`esbuild`
- Bun automatically loads `.env`, never use dotenv

**API Preferences:**
- `bun:sqlite` for SQLite, NOT `better-sqlite3`
- `Bun.file` instead of `node:fs` readFile/writeFile
- `Bun.$` instead of execa
- `Bun.serve()` for servers with WebSockets/routes, NOT express
- `WebSocket` is built-in, NOT `ws`
- `Bun.redis` for Redis, NOT `ioredis`

## Code Style

**Imports:**
- Use `node:` prefix for built-in modules: `import { mkdir } from "node:fs/promises"`
- Always include file extensions: `import { foo } from "./bar.ts"` or `import Component from "./Component.tsx"`
- Group imports: external libs, internal modules, then types

**Naming Conventions:**
- Classes/Components: `PascalCase` (e.g., `MessageStorage`, `ChatArea`)
- Functions/Variables: `camelCase` (e.g., `getMessages`, `normalizeNumber`)
- Private methods: prefix with `_` (e.g., `_saveMessage`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_SIGNAL_CLI_PATH`)
- Type aliases: `PascalCase` (e.g., `ChatMessage`, `LinkStatus`)

**React/Ink TUI:**
- Use functional components with hooks only
- React 19 - no need for `import React`
- Destructure props directly in function signature
- Use `useState`, `useEffect`, `useRef` from `react`
- Use Ink components: `Box`, `Text`, `useApp`, `useInput`

**TypeScript:**
- Strict mode enabled
- Use type imports: `import type { Foo } from "./bar"`
- Union literals with `as const` for narrow types
- JSDoc comments on all public functions

**Testing:**
- Use `bun:test`: `import { test, expect, describe, beforeEach, afterAll } from "bun:test"`
- Test files named `*.test.ts` next to source files
- Use `beforeEach`/`afterAll` for setup/teardown
- Clean up test databases after each test

**Error Handling:**
- Type check errors: `if (error instanceof Error)`
- Graceful shutdown with refs to track intentional stops
- Wrap subprocess operations in try-catch
- Emit error events for async operations

**Database (bun:sqlite):**
- Parameterized queries with `$param` syntax
- Use prepared statements with `query().run()`
- Handle missing columns gracefully with try-catch

**Signal-CLI Integration:**
- JSON-RPC over stdin/stdout via `Bun.spawn()`
- Manage pending requests with timeout handling
- Buffer parsing for multi-line JSON responses
- Emit events for: `message`, `sync`, `error`, `close`
