/**
 * Test the audit verification circuit
 */

const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

async function testCircuit() {
  console.log("🧪 Testing audit verification circuit...\n");

  const buildDir = path.join(__dirname, "../build");
  
  // Test inputs
  const projectAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
  const auditorAddress = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";
  
  // Convert addresses to uint256
  const projectUint = BigInt(projectAddress);
  const auditorUint = BigInt(auditorAddress);
  
  // Private inputs
  const auditReportHash = ethers.keccak256(ethers.toUtf8Bytes("Full confidential audit report..."));
  const vulnerabilityCount = 5;
  const severityScore = 250;
  const nonce = Math.floor(Math.random() * 1000000);
  
  // Compute summary hash (matches circuit logic)
  const hash1 = projectUint + auditorUint;
  const hash2 = hash1 * BigInt(auditReportHash);
  const hash3 = hash2 + BigInt(vulnerabilityCount);
  const summaryHash = hash3 + BigInt(nonce);
  
  const input = {
    projectAddress: projectUint.toString(),
    auditorAddress: auditorUint.toString(),
    summaryHash: BigInt(summaryHash).toString(),
    auditReportHash: BigInt(auditReportHash).toString(),
    vulnerabilityCount: vulnerabilityCount,
    severityScore: severityScore,
    nonce: nonce
  };

  console.log("📝 Test inputs:");
  console.log("   Project:", projectAddress);
  console.log("   Auditor:", auditorAddress);
  console.log("   Vulnerabilities:", vulnerabilityCount, "(private)");
  console.log("   Severity Score:", severityScore, "(private)");
  console.log("   Summary Hash:", summaryHash.toString());

  // Generate witness
  console.log("\n🔄 Generating witness...");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    path.join(buildDir, "audit_verification_js", "audit_verification.wasm"),
    path.join(buildDir, "audit_verification_0001.zkey")
  );

  console.log("✅ Proof generated!");
  console.log("\n📊 Public signals:");
  console.log("   Project Address:", publicSignals[0]);
  console.log("   Auditor Address:", publicSignals[1]);
  console.log("   Summary Hash:", publicSignals[2]);

  // Verify proof
  console.log("\n🔍 Verifying proof...");
  const vKey = JSON.parse(
    fs.readFileSync(path.join(buildDir, "verification_key.json"))
  );

  const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);

  if (verified) {
    console.log("✅ Proof verified successfully!");
  } else {
    console.log("❌ Proof verification failed!");
    process.exit(1);
  }

  // Save proof for testing
  fs.writeFileSync(
    path.join(buildDir, "test_proof.json"),
    JSON.stringify({ proof, publicSignals }, null, 2)
  );

  console.log("\n💾 Test proof saved to build/test_proof.json");
}

testCircuit()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
