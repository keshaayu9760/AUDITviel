/**
 * ZK Proof Service
 * 
 * Generates real zero-knowledge proofs using snarkjs and Groth16.
 * Replaces the mock proof generation with actual cryptographic proofs.
 */

const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

class ZKProofService {
  constructor() {
    this.circuitPath = path.join(__dirname, "../../circuits/build");
    this.wasmPath = path.join(this.circuitPath, "audit_verification_js", "audit_verification.wasm");
    this.zkeyPath = path.join(this.circuitPath, "audit_verification_0001.zkey");
    this.vkeyPath = path.join(this.circuitPath, "verification_key.json");
    
    this.initialized = false;
    this.verificationKey = null;
  }

  /**
   * Initialize the service by loading verification key
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Check if circuit files exist
      if (!fs.existsSync(this.wasmPath)) {
        console.warn("⚠️  ZK circuit WASM not found. Run: cd circuits && npm run compile && npm run setup");
        return false;
      }

      if (!fs.existsSync(this.zkeyPath)) {
        console.warn("⚠️  ZK proving key not found. Run: cd circuits && npm run setup");
        return false;
      }

      if (!fs.existsSync(this.vkeyPath)) {
        console.warn("⚠️  ZK verification key not found. Run: cd circuits && npm run setup");
        return false;
      }

      this.verificationKey = JSON.parse(fs.readFileSync(this.vkeyPath, "utf8"));
      this.initialized = true;
      console.log("✅ ZK Proof Service initialized with real Groth16 proofs");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize ZK Proof Service:", error.message);
      return false;
    }
  }

  /**
   * Generate a zero-knowledge proof for an audit
   * 
   * @param {Object} params
   * @param {string} params.projectAddress - Project address (0x...)
   * @param {string} params.auditorAddress - Auditor address (0x...)
   * @param {string} params.auditReportHash - Hash of full audit report (private)
   * @param {number} params.vulnerabilityCount - Number of vulnerabilities (private)
   * @param {number} params.severityScore - Severity score (private)
   * @param {number} params.nonce - Random nonce for uniqueness
   * @returns {Promise<Object>} { proof, publicSignals, summaryHash }
   */
  async generateProof({
    projectAddress,
    auditorAddress,
    auditReportHash,
    vulnerabilityCount = 0,
    severityScore = 0,
    nonce = null
  }) {
    const startTime = Date.now();

    // Ensure service is initialized
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error("ZK Proof Service not initialized. Please run circuit setup.");
      }
    }

    try {
      // Normalize addresses
      const project = ethers.getAddress(projectAddress);
      const auditor = ethers.getAddress(auditorAddress);

      // Convert addresses to uint256
      const projectUint = BigInt(project);
      const auditorUint = BigInt(auditor);

      // Generate nonce if not provided
      if (nonce === null) {
        nonce = Math.floor(Math.random() * 1000000000);
      }

      // Ensure auditReportHash is bytes32
      let reportHash;
      if (auditReportHash.startsWith("0x")) {
        reportHash = auditReportHash;
      } else {
        reportHash = "0x" + auditReportHash;
      }

      // Compute summary hash (public output)
      // This matches the circuit's hash computation
      // In production, this would use Poseidon hash to match the circuit
      const hash1 = projectUint + auditorUint;
      const hash2 = hash1 * BigInt(reportHash);
      const hash3 = hash2 + BigInt(vulnerabilityCount);
      const summaryHash = hash3 + BigInt(nonce);

      // Prepare circuit inputs
      const input = {
        projectAddress: projectUint.toString(),
        auditorAddress: auditorUint.toString(),
        summaryHash: BigInt(summaryHash).toString(),
        auditReportHash: BigInt(reportHash).toString(),
        vulnerabilityCount: vulnerabilityCount,
        severityScore: severityScore,
        nonce: nonce
      };

      console.log("🔄 Generating ZK proof...");
      console.log("   Project:", project);
      console.log("   Auditor:", auditor);
      console.log("   Vulnerabilities:", vulnerabilityCount, "(private)");
      console.log("   Severity:", severityScore, "(private)");

      // Generate the proof using Groth16
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        this.wasmPath,
        this.zkeyPath
      );

      const duration = Date.now() - startTime;
      console.log(`✅ ZK proof generated in ${duration}ms`);

      // Verify proof locally before returning
      const verified = await this.verifyProof(proof, publicSignals);
      if (!verified) {
        throw new Error("Generated proof failed local verification");
      }

      return {
        proof,
        publicSignals,
        summaryHash,
        stats: {
          durationMs: duration,
          proofType: "Groth16",
          circuitName: "audit_verification"
        }
      };
    } catch (error) {
      console.error("❌ ZK proof generation failed:", error.message);
      throw error;
    }
  }

  /**
   * Verify a zero-knowledge proof
   * 
   * @param {Object} proof - The proof object
   * @param {Array} publicSignals - Public signals array
   * @returns {Promise<boolean>} True if proof is valid
   */
  async verifyProof(proof, publicSignals) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const verified = await snarkjs.groth16.verify(
        this.verificationKey,
        publicSignals,
        proof
      );

      return verified;
    } catch (error) {
      console.error("❌ ZK proof verification failed:", error.message);
      return false;
    }
  }

  /**
   * Convert snarkjs proof format to Solidity calldata format
   * 
   * @param {Object} proof - snarkjs proof object
   * @param {Array} publicSignals - Public signals array
   * @returns {Object} { a, b, c, input }
   */
  formatProofForSolidity(proof, publicSignals) {
    return {
      a: [proof.pi_a[0], proof.pi_a[1]],
      b: [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]]
      ],
      c: [proof.pi_c[0], proof.pi_c[1]],
      input: publicSignals.map(s => s.toString())
    };
  }

  /**
   * Encode proof as bytes for contract call
   * 
   * @param {Object} proof - snarkjs proof object
   * @returns {string} Hex-encoded proof bytes
   */
  encodeProofAsBytes(proof) {
    const formatted = this.formatProofForSolidity(proof, []);
    
    // Encode as: [a.x, a.y, b.x0, b.x1, b.y0, b.y1, c.x, c.y]
    const proofArray = [
      formatted.a[0],
      formatted.a[1],
      formatted.b[0][0],
      formatted.b[0][1],
      formatted.b[1][0],
      formatted.b[1][1],
      formatted.c[0],
      formatted.c[1]
    ];

    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256[8]"],
      [proofArray]
    );
  }

  /**
   * Check if ZK proof system is available
   * 
   * @returns {boolean}
   */
  isAvailable() {
    return this.initialized && 
           fs.existsSync(this.wasmPath) && 
           fs.existsSync(this.zkeyPath);
  }
}

// Singleton instance
const zkProofService = new ZKProofService();

module.exports = zkProofService;
