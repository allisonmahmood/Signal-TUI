# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Signal-TUI is a Terminal User Interface for Signal Messenger, built with Bun, React, and Ink. It communicates with signal-cli via JSON-RPC over stdin/stdout.

## Commands

```bash
bun start                                    # Start the TUI application
bun run typecheck                            # Run TypeScript type checking
bun test                                     # Run all tests
bun test src/core/MessageStorage.test.ts    # Run a single test file
bun run build                                # Build for current platform
```

## Architecture

```
src/
├── core/                    # Core business logic
│   ├── SignalClient.ts      # JSON-RPC wrapper around signal-cli (spawns process, handles requests/events)
│   ├── MessageStorage.ts    # SQLite message persistence with EventEmitter for real-time updates
│   └── Config.ts            # Configuration management with auto-detection
├── ui/                      # React/Ink TUI components
│   ├── index.tsx            # Entry point
│   ├── App.tsx              # Main app: initializes client/storage, manages app state (loading→onboarding→chat)
│   ├── theme.ts             # Color theme constants
│   └── components/
│       ├── Sidebar.tsx      # Conversation list with search and keyboard navigation
│       ├── ChatArea.tsx     # Message display with attachments and ASCII art images
│       ├── MessageInput.tsx # Text input with /attach command support
│       ├── Onboarding.tsx   # Device linking with QR code display
│       ├── StatusBar.tsx    # Connection status and account info
│       └── KeybindBar.tsx   # Context-aware keyboard shortcut hints
├── types/types.ts           # All TypeScript type definitions
└── utils/                   # Phone normalization, conversation sorting, MIME types, ASCII art
```

**Key data flow:** signal-cli JSON-RPC → SignalClient events → App.tsx → MessageStorage (SQLite + event emission) → UI components listen to storage events

## Bun Runtime

Default to Bun instead of Node.js:
- `bun <file>` instead of `node` or `ts-node`
- `bun:sqlite` for SQLite (not better-sqlite3)
- `Bun.spawn()` for subprocesses
- `Bun.file` instead of `node:fs` readFile/writeFile
- Bun automatically loads `.env`, never use dotenv

## Code Style

**Imports:** Use `node:` prefix for builtins, include file extensions (e.g., `import { foo } from "./bar.ts"`)

**Naming:** PascalCase for classes/components, camelCase for functions/variables, `_prefix` for private methods

**React/Ink:** Functional components with hooks only, React 19 (no `import React` needed)

**Testing:** Use `bun:test`, files named `*.test.ts` next to source, clean up test databases in `afterAll`

**Database:** Parameterized queries with `$param` syntax, prepared statements with `query().run()`

## Signal-CLI Integration

- JSON-RPC over stdin/stdout via `Bun.spawn()`
- SignalClient emits events: `message`, `sync`, `receipt`, `typing`, `error`, `close`, `ready`, `linkSuccess`
- Receipt types: `DELIVERY`, `READ`, `VIEWED` — used for message status indicators (◯ → ✓ → ✓✓)

## Media/Attachments

- Images rendered as ASCII art via `ink-asciify-image`, stored in database (not re-rendered)
- `/attach <filepath> [message]` command to send files
- Attachments table tracks download status: `pending` → `downloading` → `completed`/`failed`
- MIME type utilities in `src/utils/mime.ts`

## Configuration

- Config file: `~/.signal-tui/config.json`
- Database: `~/.signal-tui/db.sqlite`
- signal-cli path detection: config file → `SIGNAL_CLI_PATH` env → common paths (`/usr/bin/signal-cli`, etc.)
