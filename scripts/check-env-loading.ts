/**
 * Check what OFFRAMP_MASTER_MNEMONIC value Node.js is actually seeing
 */

const mnemonic = process.env.OFFRAMP_MASTER_MNEMONIC;

console.log("🔍 Checking Environment Variable Loading\n");
console.log("Raw value type:", typeof mnemonic);
console.log("Is defined:", mnemonic !== undefined);
console.log("Is null:", mnemonic === null);
console.log("Is empty string:", mnemonic === "");
console.log("Length:", mnemonic?.length || 0);

if (mnemonic) {
  const words = mnemonic.trim().split(/\s+/);
  console.log("Word count:", words.length);
  console.log("First 3 words:", words.slice(0, 3).join(" "));
  console.log("Last 3 words:", words.slice(-3).join(" "));
  
  // Check for hidden characters
  console.log("\nCharacter analysis:");
  console.log("Contains \\n:", mnemonic.includes("\n"));
  console.log("Contains \\r:", mnemonic.includes("\r"));
  console.log("Contains \\t:", mnemonic.includes("\t"));
  console.log("Starts with space:", mnemonic.startsWith(" "));
  console.log("Ends with space:", mnemonic.endsWith(" "));
} else {
  console.log("\n❌ OFFRAMP_MASTER_MNEMONIC is NOT SET!");
}
