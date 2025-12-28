import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

export interface Config {
  signalCliPath?: string;
}

const CONFIG_DIR = join(homedir(), ".signal-tui");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

const COMMON_SIGNAL_CLI_PATHS = [
  "/usr/bin/signal-cli",
  "/usr/local/bin/signal-cli",
  "/opt/homebrew/bin/signal-cli",
];

/**
 * Load configuration from ~/.signal-tui/config.json
 * Returns empty object if file doesn't exist
 */
export function loadConfig(): Config {
  try {
    const file = Bun.file(CONFIG_PATH);
    if (!existsSync(CONFIG_PATH)) {
      return {};
    }
    // Use synchronous read for simplicity during startup
    const content = require("node:fs").readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(content) as Config;
  } catch {
    return {};
  }
}

/**
 * Find the signal-cli executable path
 * Resolution order:
 * 1. Config file signalCliPath
 * 2. SIGNAL_CLI_PATH environment variable
 * 3. First existing path from common locations
 * 4. Returns null if not found
 */
export function findSignalCliPath(): string | null {
  const config = loadConfig();

  // 1. Check config file
  if (config.signalCliPath) {
    if (existsSync(config.signalCliPath)) {
      return config.signalCliPath;
    }
    // Config specifies a path but it doesn't exist - still return it
    // so the error message is clear about what was configured
    return config.signalCliPath;
  }

  // 2. Check environment variable
  const envPath = process.env.SIGNAL_CLI_PATH;
  if (envPath) {
    return envPath;
  }

  // 3. Try common paths
  for (const path of COMMON_SIGNAL_CLI_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }

  // 4. Not found
  return null;
}

/**
 * Get helpful instructions for configuring signal-cli path
 */
export function getConfigInstructions(): string {
  const searchedPaths = COMMON_SIGNAL_CLI_PATHS.map((p) => `  - ${p}`).join("\n");

  return `signal-cli not found!

Searched the following locations:
${searchedPaths}

To configure, create ${CONFIG_PATH}:
{
  "signalCliPath": "/path/to/your/signal-cli"
}

Or set the SIGNAL_CLI_PATH environment variable.`;
}
