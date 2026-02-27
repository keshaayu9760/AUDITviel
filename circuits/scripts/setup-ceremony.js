/**
 * Trusted setup ceremony (CLI-based).
 *
 * Uses snarkjs CLI commands for better compatibility across versions.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const buildDir = path.join(rootDir, "build");

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: "inherit" });
}

function main() {
  console.log("Starting trusted setup ceremony...");

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const r1csPath = path.join(buildDir, "audit_verification.r1cs");
  if (!fs.existsSync(r1csPath)) {
    console.error("R1CS file not found. Run `npm run compile` first.");
    process.exit(1);
  }

  run("npx snarkjs powersoftau new bn128 12 build/pot12_0000.ptau -v");
  run('npx snarkjs powersoftau contribute build/pot12_0000.ptau build/pot12_0001.ptau --name=\"first\" -v -e=\"entropy\"');
  run("npx snarkjs powersoftau prepare phase2 build/pot12_0001.ptau build/pot12_final.ptau -v");

  run("npx snarkjs groth16 setup build/audit_verification.r1cs build/pot12_final.ptau build/audit_verification_0000.zkey");
  run('npx snarkjs zkey contribute build/audit_verification_0000.zkey build/audit_verification_0001.zkey --name=\"1st Contributor\" -v -e=\"entropy\"');
  run("npx snarkjs zkey export verificationkey build/audit_verification_0001.zkey build/verification_key.json");

  run("npx snarkjs zkey export solidityverifier build/audit_verification_0001.zkey ../contracts/Groth16Verifier.sol");

  console.log("\nTrusted setup complete.");
  console.log("Generated:");
  console.log(" - build/audit_verification_0001.zkey");
  console.log(" - build/verification_key.json");
  console.log(" - contracts/Groth16Verifier.sol");
}

try {
  main();
} catch (error) {
  console.error("\nSetup failed:", error.message);
  process.exit(1);
}

