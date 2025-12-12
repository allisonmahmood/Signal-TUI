import { appendFileSync } from "node:fs";
import { join } from "node:path";

console.log("Current working directory:", process.cwd());
const logFile = "debug.log";
const absPath = join(process.cwd(), logFile);

try {
  appendFileSync(logFile, `Init log check at ${new Date().toISOString()}\n`);
  console.log(`Successfully wrote to ${logFile} (${absPath})`);
} catch (error) {
  console.error(`Failed to write to ${logFile}:`, error);
}
