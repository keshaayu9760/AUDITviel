/**
 * Real cryptographic signature generation for ZKVerifier proof payloads
 * 
 * This module implements EXACTLY the same hashing and signing logic as the
 * ZKVerifier.sol contract's verifyProof() function.
 * 
 * NO mocks, NO dev-mode bypasses - only real cryptographic signatures.
 */

const { ethers } = require("ethers");

/**
 * Sign a proof payload using the exact same logic as ZKVerifier.verifyProof()
 * 
 * Contract logic:
 *   bytes32 inputsHash = keccak256(abi.encode(publicInputs));
 *   bytes32 messageHash = keccak256(abi.encode(
 *       address(this),
 *       payload.proofId,
 *       payload.issuer,
 *       payload.subject,
 *       keccak256(payload.proof),
 *       inputsHash
 *   ));
 *   // Then EIP-191: "\x19Ethereum Signed Message:\n32" + messageHash
 *   address signer = ecrecover(ethSignedMessageHash, v, r, s);
 * 
 * @param {Object} params
 * @param {string} params.trustedProverPrivateKey - Private key of trusted prover (with or without 0x)
 * @param {string} params.zkVerifierAddress - Address of ZKVerifier contract
 * @param {string} params.proofId - bytes32 proofId (hex string)
 * @param {string} params.issuer - address of issuer/auditor
 * @param {string} params.subject - address of subject/project
 * @param {string} params.proofBytesHex - bytes proof data (hex string with 0x)
 * @param {string[]} params.publicInputs - Array of uint256 public inputs as strings or BigInts
 * @returns {Promise<string>} 65-byte signature (0x + 130 hex chars)
 */
async function signProofPayload({
  trustedProverPrivateKey,
  zkVerifierAddress,
  proofId,
  issuer,
  subject,
  proofBytesHex,
  publicInputs
}) {
  // Normalize private key
  const privateKey = trustedProverPrivateKey.startsWith("0x") 
    ? trustedProverPrivateKey 
    : `0x${trustedProverPrivateKey}`;

  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKey);

  // Normalize addresses
  const zkVerifierAddr = ethers.getAddress(zkVerifierAddress);
  const issuerAddr = ethers.getAddress(issuer);
  const subjectAddr = ethers.getAddress(subject);

  // Normalize proofId to bytes32
  let proofIdBytes32;
  if (proofId.startsWith("0x")) {
    proofIdBytes32 = ethers.zeroPadValue(proofId, 32);
  } else {
    proofIdBytes32 = ethers.zeroPadValue(`0x${proofId}`, 32);
  }

  // Step 1: Hash the proof bytes
  // Contract: keccak256(payload.proof)
  const proofHash = ethers.keccak256(proofBytesHex);

  // Step 2: Hash the public inputs
  // Contract: bytes32 inputsHash = keccak256(abi.encode(publicInputs));
  const publicInputsBigInt = publicInputs.map(p => BigInt(p));
  const inputsHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256[]"],
      [publicInputsBigInt]
    )
  );

  // Step 3: Create the message hash
  // Contract: bytes32 messageHash = keccak256(abi.encode(
  //     address(this),
  //     payload.proofId,
  //     payload.issuer,
  //     payload.subject,
  //     keccak256(payload.proof),
  //     inputsHash
  // ));
  const messageHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes32", "address", "address", "bytes32", "bytes32"],
      [
        zkVerifierAddr,
        proofIdBytes32,
        issuerAddr,
        subjectAddr,
        proofHash,
        inputsHash
      ]
    )
  );

  // Step 4: Sign using EIP-191 format
  // ethers.Wallet.signMessage() automatically applies: "\x19Ethereum Signed Message:\n32" + messageHash
  // This matches the contract's _recoverSigner() logic exactly
  // The contract expects: bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
  // ethers.signMessage() does this automatically
  const signature = await wallet.signMessage(ethers.getBytes(messageHash));

  // Verify signature format
  if (signature.length !== 132) { // 0x + 130 hex chars = 65 bytes
    throw new Error(`Invalid signature length: ${signature.length}, expected 132 (65 bytes)`);
  }

  // Verify signature components
  const sigBytes = ethers.getBytes(signature);
  if (sigBytes.length !== 65) {
    throw new Error(`Invalid signature byte length: ${sigBytes.length}, expected 65`);
  }

  // Extract v (last byte)
  // The contract reads v as a byte and adds 27 if v < 27
  // ethers.signMessage() returns v as 27 or 28, which is correct
  // But we need to ensure the contract can read it correctly
  const v = sigBytes[64];
  if (v !== 27 && v !== 28) {
    throw new Error(`Invalid v value: ${v}, must be 27 or 28`);
  }

  // The signature is already in the correct format (r 32 bytes + s 32 bytes + v 1 byte)
  // The contract will read v from position 96 (the 65th byte) and add 27 if needed
  // Since ethers returns v as 27 or 28, the contract will read it correctly
  return signature;
}

/**
 * Recover the signer from a proof payload signature
 * 
 * This recomputes the message hash and recovers the signer address.
 * Used for local validation before calling the contract.
 * 
 * @param {Object} params
 * @param {string} params.zkVerifierAddress - Address of ZKVerifier contract
 * @param {string} params.proofId - bytes32 proofId (hex string)
 * @param {string} params.issuer - address of issuer/auditor
 * @param {string} params.subject - address of subject/project
 * @param {string} params.proofBytesHex - bytes proof data (hex string with 0x)
 * @param {string[]} params.publicInputs - Array of uint256 public inputs as strings or BigInts
 * @param {string} params.signature - 65-byte signature (hex string with 0x)
 * @returns {string} Recovered signer address (checksummed)
 */
function recoverSignerFromSignature({
  zkVerifierAddress,
  proofId,
  issuer,
  subject,
  proofBytesHex,
  publicInputs,
  signature
}) {
  // Normalize addresses
  const zkVerifierAddr = ethers.getAddress(zkVerifierAddress);
  const issuerAddr = ethers.getAddress(issuer);
  const subjectAddr = ethers.getAddress(subject);

  // Normalize proofId to bytes32
  let proofIdBytes32;
  if (proofId.startsWith("0x")) {
    proofIdBytes32 = ethers.zeroPadValue(proofId, 32);
  } else {
    proofIdBytes32 = ethers.zeroPadValue(`0x${proofId}`, 32);
  }

  // Step 1: Hash the proof bytes
  const proofHash = ethers.keccak256(proofBytesHex);

  // Step 2: Hash the public inputs
  const publicInputsBigInt = publicInputs.map(p => BigInt(p));
  const inputsHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256[]"],
      [publicInputsBigInt]
    )
  );

  // Step 3: Create the message hash (same as signing)
  const messageHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes32", "address", "address", "bytes32", "bytes32"],
      [
        zkVerifierAddr,
        proofIdBytes32,
        issuerAddr,
        subjectAddr,
        proofHash,
        inputsHash
      ]
    )
  );

  // Step 4: Recover signer using EIP-191 format
  // Contract logic: bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
  // Then: ecrecover(ethSignedMessageHash, v, r, s)
  // ethers.recoverAddress() expects the EIP-191 prefixed hash
  const prefix = "\x19Ethereum Signed Message:\n32";
  const prefixedMessage = ethers.concat([
    ethers.toUtf8Bytes(prefix),
    ethers.getBytes(messageHash)
  ]);
  const ethSignedMessageHash = ethers.keccak256(prefixedMessage);

  // Recover address from signature
  // ethers.recoverAddress() will handle the signature parsing and recovery
  const recoveredAddress = ethers.recoverAddress(ethSignedMessageHash, signature);

  return ethers.getAddress(recoveredAddress);
}

module.exports = {
  signProofPayload,
  recoverSignerFromSignature
};

