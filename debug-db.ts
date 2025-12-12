import { Database } from "bun:sqlite";
import { join } from "node:path";
import { homedir } from "node:os";

const dbPath = join(homedir(), ".signal-tui", "db.sqlite");
console.log("Opening DB at:", dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  
  const count = db.query("SELECT count(*) as c FROM messages").get() as { c: number };
  console.log(`Total messages: ${count.c}`);

  const rows = db.query("SELECT * FROM messages ORDER BY timestamp DESC LIMIT 10").all();
  console.log("\nLast 10 messages:");
  console.table(rows);

} catch (e) {
  console.error("Error reading DB:", e);
}
