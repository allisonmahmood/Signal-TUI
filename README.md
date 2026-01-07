# 📱 Signal-TUI

[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> A beautiful Terminal User Interface for Signal Messenger, built with [Bun](https://bun.sh), [React](https://react.dev/), and [Ink](https://github.com/vadimdemedes/ink).

---

## ✨ Features

- 💬 **Real-time Messaging** — Send and receive messages instantly via signal-cli
- 🖼️ **Media Support** — View images as ASCII art, send attachments with the `/attach` command
- 🎤 **Voice Messages** — See voice message duration and metadata
- ✅ **Message Status** — Track message delivery with status indicators (◯ sent, ✓ delivered, ✓✓ read)
- ⌨️ **Vim-style Navigation** — Navigate with `j`/`k`, jump with `G`/`gg`
- 🔍 **Quick Search** — Filter conversations with `/` in the sidebar
- 🎨 **Beautiful UI** — Themed interface with focus highlighting and status bar
- 📋 **Context-aware Keybinds** — Dynamic keybind bar shows available shortcuts

---

## 📋 Prerequisites

- **[Bun](https://bun.sh)** (v1.0.0 or later)
- **[signal-cli](https://github.com/AsamK/signal-cli)** — Required for Signal communication
  - Auto-detected at common paths: `/usr/bin/signal-cli`, `/usr/local/bin/signal-cli`, `/opt/homebrew/bin/signal-cli`
  - Or set a custom path via `SIGNAL_CLI_PATH` env variable or [config file](#%EF%B8%8F-configuration)

---

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/allisonmahmood/Signal-TUI.git
cd Signal-TUI

# Install dependencies
bun install
```

---

## 💻 Usage

### Starting the App

```bash
bun start
```

On first launch, you'll be guided through device linking with a QR code.

### ⌨️ Keyboard Controls

| Context       | Key              | Action                          |
| :------------ | :--------------- | :------------------------------ |
| **Global**    | `Ctrl+C`         | Quit application                |
| **Global**    | `Ctrl+L`         | Link new device                 |
| **Global**    | `Tab`            | Cycle focus (Sidebar → Chat → Input) |
| **Sidebar**   | `↑` / `k`        | Navigate up                     |
| **Sidebar**   | `↓` / `j`        | Navigate down                   |
| **Sidebar**   | `Enter`          | Select conversation             |
| **Sidebar**   | `/`              | Search/filter conversations     |
| **Sidebar**   | `Esc`            | Exit search mode                |
| **Chat**      | `↑` / `k`        | Scroll up                       |
| **Chat**      | `↓` / `j`        | Scroll down                     |
| **Chat**      | `PageUp`         | Scroll up one page              |
| **Chat**      | `PageDown`       | Scroll down one page            |
| **Chat**      | `G`              | Jump to bottom (newest)         |
| **Chat**      | `gg`             | Jump to top (oldest)            |
| **Input**     | `Enter`          | Send message                    |
| **Input**     | `Escape`         | Exit input mode                 |
| **Input**     | `Ctrl+A`         | Move cursor to start            |
| **Input**     | `Ctrl+E`         | Move cursor to end              |
| **Input**     | `Ctrl+U`         | Clear line                      |
| **Input**     | `Ctrl+W`         | Delete word backward            |

### 📎 Sending Attachments

Use the `/attach` command to send files:

```
/attach <filepath> [optional message]
```

**Examples:**
```bash
/attach ~/photos/image.png                    # Send an image
/attach "/path/with spaces/file.pdf"          # Paths with spaces (use quotes)
/attach ~/document.pdf Here's the file!       # Include a message
```

**Features:**
- ✓ Real-time file validation (green ✓ = exists, red ✗ = not found)
- ✓ Supports images, documents, audio, and any file type
- ✓ Images are displayed as ASCII art in the chat
- ✓ Voice messages show duration

---

## ⚙️ Configuration

Configuration is stored in `~/.signal-tui/config.json`. The database is automatically created on first run.

```json
{
  "signalCliPath": "/usr/bin/signal-cli"
}
```

### signal-cli Path Resolution

The app looks for `signal-cli` in this order:
1. `signalCliPath` in config file (`~/.signal-tui/config.json`)
2. `SIGNAL_CLI_PATH` environment variable
3. Auto-detect at common paths: `/usr/bin/signal-cli`, `/usr/local/bin/signal-cli`, `/opt/homebrew/bin/signal-cli`

---

## 🏗️ Architecture

```
src/
├── core/                    # Core business logic
│   ├── SignalClient.ts      # JSON-RPC wrapper for signal-cli
│   ├── MessageStorage.ts    # SQLite persistence with EventEmitter
│   └── Config.ts            # Configuration management
├── ui/                      # React/Ink components
│   ├── App.tsx              # Main app state management
│   └── components/
│       ├── Sidebar.tsx      # Conversation list with search
│       ├── ChatArea.tsx     # Message display with attachments
│       ├── MessageInput.tsx # Input with /attach support
│       ├── StatusBar.tsx    # Connection status & info
│       └── KeybindBar.tsx   # Context-aware shortcuts
├── types/                   # TypeScript definitions
└── utils/                   # Helpers (formatting, MIME types, ASCII art)
```

**Data Flow:** `signal-cli` → `SignalClient` (events) → `App.tsx` → `MessageStorage` (SQLite) → UI components

---

## 🔧 Troubleshooting

| Issue | Solution |
| :---- | :------- |
| **signal-cli not found** | Verify with `signal-cli --version`. Set path in config or `SIGNAL_CLI_PATH` env |
| **Database errors** | Delete `~/.signal-tui/db.sqlite` to reset the message cache |
| **QR code not scanning** | Ensure your terminal supports Unicode and is sized appropriately |
| **Messages not loading** | Check signal-cli is running and linked to your account |

---

## 🛠️ Built With

- **[Bun](https://bun.sh)** — Fast JavaScript runtime with native SQLite
- **[React](https://react.dev/)** — UI component library (v19)
- **[Ink](https://github.com/vadimdemedes/ink)** — React for CLIs
- **[signal-cli](https://github.com/AsamK/signal-cli)** — Signal Messenger CLI

---

## 📄 License

MIT
