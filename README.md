# signal-tui

A Terminal User Interface (TUI) for Signal, built with [Bun](https://bun.com) and [Ink](https://github.com/vadimdemedes/ink).

## Prerequisites

- **[Bun](https://bun.com)** (v1.0.0 or later)
- **[signal-cli](https://github.com/AsamK/signal-cli)**: This project relies on `signal-cli` running as a daemon or accessible via command line.
  - Ensure `signal-cli` is installed and linked in your system path.

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
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

| Context     | Key        | Action                 |
| :---------- | :--------- | :--------------------- |
| **Global**  | `Ctrl+C`   | Quit Application       |
| **Global**  | `Ctrl+L`   | Link New Device        |
| **Sidebar** | `↑` / `↓`  | Navigate Conversations |
| **Sidebar** | `Enter`    | Select Conversation    |
| **Chat**    | `Enter`    | Send Message           |
| **Chat**    | `PageUp`   | Scroll History Up      |
| **Chat**    | `PageDown` | Scroll History Down    |

## Troubleshooting

- **`signal-cli` not found**: Make sure `signal-cli` is in your PATH. You can verify this by running `signal-cli --version` in your terminal.
- **Database issues**: If you encounter local database errors, try clearing the `~/.signal-tui` directory to reset the local cache.
