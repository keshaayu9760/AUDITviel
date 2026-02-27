// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ZKVerifier
 * @dev Lightweight verifier that validates prover-signed zero-knowledge proof attestations
 * @notice The contract expects the trusted prover to sign the proof payload off-chain using EIP-191
 */
contract ZKVerifier {
    address public admin;
    address public trustedProver;

    event TrustedProverUpdated(address indexed previousProver, address indexed newProver);
    event ProofVerified(bytes32 indexed proofId, address indexed subject, address indexed issuer, uint256 gasUsed, bytes32 inputsHash);

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

    constructor(address _trustedProver) {
        admin = msg.sender;
        if (_trustedProver != address(0)) {
            trustedProver = _trustedProver;
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
     * @dev Transfers admin role to a new address
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin");
        admin = newAdmin;
    }

    /**
     * @dev Verifies the prover signature over the proof payload and public inputs
     * @param payload Structured proof payload containing identifiers and signature
     * @param publicInputs Array of public inputs associated with the proof
     * @return bool True when verification succeeds
     */
    function verifyProof(ProofPayload calldata payload, uint256[] calldata publicInputs) external returns (bool) {
        require(trustedProver != address(0), "Prover not configured");
        require(payload.signature.length == 65, "Invalid signature length");

        uint256 gasBefore = gasleft();

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

        emit ProofVerified(payload.proofId, payload.subject, payload.issuer, gasUsed, inputsHash);
        return true;
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

