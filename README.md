# signal-tui

A Terminal User Interface (TUI) for Signal, built with [Bun](https://bun.sh) and [Ink](https://github.com/vadimdemedes/ink).

## Prerequisites

- **[Bun](https://bun.sh)** (v1.0.0 or later)
- **[signal-cli](https://github.com/AsamK/signal-cli)**: This project relies on `signal-cli` for Signal communication.
  - The app will auto-detect `signal-cli` at common paths (`/usr/bin/signal-cli`, `/usr/local/bin/signal-cli`, `/opt/homebrew/bin/signal-cli`)
  - You can also set a custom path via the `SIGNAL_CLI_PATH` environment variable or config file (see [Configuration](#configuration))

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/allisonmahmood/Signal-TUI.git
   cd Signal-TUI
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

## Usage

To start the application:

```bash
bun start
```

### Controls

| Context     | Key        | Action                    |
| :---------- | :--------- | :------------------------ |
| **Global**  | `Ctrl+C`   | Quit Application          |
| **Global**  | `Ctrl+L`   | Link New Device           |
| **Global**  | `Tab`      | Cycle Focus (Sidebar → Chat → Input) |
| **Sidebar** | `↑` / `↓`  | Navigate Conversations    |
| **Sidebar** | `Enter`    | Select Conversation       |
| **Chat**    | `PageUp`   | Scroll History Up         |
| **Chat**    | `PageDown` | Scroll History Down       |
| **Input**   | `Enter`    | Send Message              |
| **Input**   | `Escape`   | Exit Input Mode           |
| **Input**   | `Ctrl+A`   | Move Cursor to Start      |
| **Input**   | `Ctrl+E`   | Move Cursor to End        |
| **Input**   | `Ctrl+U`   | Clear Line                |
| **Input**   | `Ctrl+W`   | Delete Word Backward      |

## Configuration

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

## Troubleshooting

- **`signal-cli` not found**: The app will show a helpful error with setup instructions. You can verify signal-cli is installed by running `signal-cli --version`. If it's installed at a non-standard path, set it in the config file or via `SIGNAL_CLI_PATH` environment variable.
- **Database issues**: If you encounter local database errors, try deleting `~/.signal-tui/db.sqlite` to reset the message cache.
