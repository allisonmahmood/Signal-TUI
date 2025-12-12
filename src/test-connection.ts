/**
 * Test script to verify signal-cli connection
 * 
 * Run with: bun run src/test-connection.ts
 */

import { SignalClient } from "./core/SignalClient";
import type { SignalEnvelope, VersionResponse } from "./types/types";

async function main() {
  console.log("🚀 Starting SignalClient test...\n");

  const client = new SignalClient();

  // Set up event handlers
  client.on("ready", () => {
    console.log("✅ SignalClient is ready\n");
  });

  client.on("message", (envelope: SignalEnvelope) => {
    const sender = envelope.sourceName || envelope.sourceNumber || envelope.source || "Unknown";
    const message = envelope.dataMessage?.message || "[no text content]";
    console.log(`📨 Message from ${sender}: ${message}`);
  });

  client.on("receipt", (envelope: SignalEnvelope) => {
    console.log(`📬 Receipt: ${envelope.receiptMessage?.type} for timestamps:`, envelope.receiptMessage?.timestamps);
  });

  client.on("typing", (envelope: SignalEnvelope) => {
    const sender = envelope.sourceName || envelope.sourceNumber || "Unknown";
    console.log(`⌨️  ${sender} is ${envelope.typingMessage?.action === "STARTED" ? "typing..." : "stopped typing"}`);
  });

  client.on("error", (error: Error) => {
    console.error("❌ Error:", error.message);
  });

  client.on("close", (code: number | null) => {
    console.log(`\n🛑 signal-cli exited with code: ${code}`);
  });

  try {
    // Start the client
    console.log("Starting signal-cli...");
    await client.start();

    // Test the version command
    console.log("Testing 'version' command...");
    const version = await client.sendRequest<VersionResponse>("version");
    console.log(`📋 signal-cli version: ${version.version}\n`);

    // Test listAccounts to see registered accounts
    console.log("Testing 'listAccounts' command...");
    try {
      const accounts = await client.sendRequest<unknown[]>("listAccounts");
      if (accounts.length > 0) {
        console.log("📱 Registered accounts:");
        accounts.forEach((account) => {
          if (typeof account === "string") {
            console.log(`   - ${account}`);
          } else if (typeof account === "object" && account !== null) {
            // Handle object format - may have 'number' or other fields
            const acc = account as Record<string, unknown>;
            const display = acc.number || acc.uuid || acc.id || JSON.stringify(account);
            console.log(`   - ${display}`);
          } else {
            console.log(`   - ${JSON.stringify(account)}`);
          }
        });
      } else {
        console.log("⚠️  No accounts registered. You may need to link/register first.");
      }
    } catch (error) {
      console.log("⚠️  Could not list accounts:", (error as Error).message);
    }

    console.log("\n👂 Listening for incoming messages for 30 seconds...");
    console.log("   Send a message to your Signal account to test!\n");

    // Listen for messages for 30 seconds
    await new Promise((resolve) => setTimeout(resolve, 30000));

    console.log("\n⏱️  Test complete, stopping client...");
    client.stop();
    console.log("👋 Done!");

  } catch (error) {
    console.error("❌ Failed to run test:", (error as Error).message);
    client.stop();
    process.exit(1);
  }
}

main();
