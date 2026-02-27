// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ZKVerifierGroth16
 * @dev Enhanced ZK verifier that supports both signature-based and Groth16 proof verification
 * @notice This contract can verify real zero-knowledge proofs using Groth16 or fallback to signature verification
 */

interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[3] calldata _pubSignals
    ) external view returns (bool);
}

contract ZKVerifierGroth16 {
    address public admin;
    address public trustedProver;
    address public groth16Verifier; // Optional Groth16 verifier contract

    event TrustedProverUpdated(address indexed previousProver, address indexed newProver);
    event Groth16VerifierUpdated(address indexed previousVerifier, address indexed newVerifier);
    event ProofVerified(
        bytes32 indexed proofId,
        address indexed subject,
        address indexed issuer,
        uint256 gasUsed,
        bytes32 inputsHash,
        string proofType
    );

    struct ProofPayload {
        bytes32 proofId;
        address issuer;
        address subject;
        bytes proof;
        bytes signature;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not authorized");
        _;
    }

    constructor(address _trustedProver, address _groth16Verifier) {
        admin = msg.sender;
        if (_trustedProver != address(0)) {
            trustedProver = _trustedProver;
        }
        if (_groth16Verifier != address(0)) {
            groth16Verifier = _groth16Verifier;
        }
    }

    /**
     * @dev Allows the admin to update the trusted prover address
     */
    function setTrustedProver(address _trustedProver) external onlyAdmin {
        require(_trustedProver != address(0), "Invalid prover");
        emit TrustedProverUpdated(trustedProver, _trustedProver);
        trustedProver = _trustedProver;
    }

    /**
     * @dev Allows the admin to set the Groth16 verifier contract
     */
    function setGroth16Verifier(address _groth16Verifier) external onlyAdmin {
        require(_groth16Verifier != address(0), "Invalid verifier");
        emit Groth16VerifierUpdated(groth16Verifier, _groth16Verifier);
        groth16Verifier = _groth16Verifier;
    }

    /**
     * @dev Transfers admin role to a new address
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin");
        admin = newAdmin;
    }

    /**
     * @dev Verifies a zero-knowledge proof (Groth16 or signature-based)
     * @param payload Structured proof payload containing identifiers and signature
     * @param publicInputs Array of public inputs associated with the proof
     * @return bool True when verification succeeds
     */
    function verifyProof(ProofPayload calldata payload, uint256[] calldata publicInputs) external returns (bool) {
        uint256 gasBefore = gasleft();

        // Try Groth16 verification first if verifier is set
        if (groth16Verifier != address(0) && payload.proof.length >= 256) {
            bool groth16Valid = _verifyGroth16Proof(payload.proof, publicInputs);
            if (groth16Valid) {
                uint256 gasConsumed = gasBefore - gasleft();
                bytes32 publicInputsHash = keccak256(abi.encode(publicInputs));
                emit ProofVerified(
                    payload.proofId,
                    payload.subject,
                    payload.issuer,
                    gasConsumed,
                    publicInputsHash,
                    "Groth16"
                );
                return true;
            }
        }

        // Fallback to signature verification
        require(trustedProver != address(0), "Prover not configured");
        require(payload.signature.length == 65, "Invalid signature length");

        bytes32 inputsHash = keccak256(abi.encode(publicInputs));
        bytes32 messageHash = keccak256(
            abi.encode(
                address(this),
                payload.proofId,
                payload.issuer,
                payload.subject,
                keccak256(payload.proof),
                inputsHash
            )
        );

        address signer = _recoverSigner(messageHash, payload.signature);
        require(signer == trustedProver, "Invalid proof signature");

        uint256 gasUsed = gasBefore - gasleft();

        emit ProofVerified(
            payload.proofId,
            payload.subject,
            payload.issuer,
            gasUsed,
            inputsHash,
            "Signature"
        );
        return true;
    }

    /**
     * @dev Verify a Groth16 proof
     * @param proofBytes Encoded proof data (8 uint256 values: a.x, a.y, b.x0, b.x1, b.y0, b.y1, c.x, c.y)
     * @param publicInputs Public signals (must be exactly 3 values)
     * @return bool True if proof is valid
     */
    function _verifyGroth16Proof(bytes calldata proofBytes, uint256[] calldata publicInputs) private view returns (bool) {
        if (publicInputs.length != 3) return false;
        // Groth16 proof is expected to encode exactly 8 uint256 values.
        if (proofBytes.length != 256) return false;

        // Decode proof components
        uint256[8] memory proofArray = abi.decode(proofBytes, (uint256[8]));

        uint[2] memory a = [proofArray[0], proofArray[1]];
        uint[2][2] memory b = [
            [proofArray[2], proofArray[3]],
            [proofArray[4], proofArray[5]]
        ];
        uint[2] memory c = [proofArray[6], proofArray[7]];
        uint[3] memory pubSignals = [publicInputs[0], publicInputs[1], publicInputs[2]];

        try IGroth16Verifier(groth16Verifier).verifyProof(a, b, c, pubSignals) returns (bool valid) {
            return valid;
        } catch {
            return false;
        }
    }

    function _recoverSigner(bytes32 messageHash, bytes memory signature) private pure returns (address) {
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "Invalid v value");
        return ecrecover(ethSignedMessageHash, v, r, s);
    }
}
