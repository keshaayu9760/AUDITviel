// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAuditorRegistry {
    function isApprovedAuditor(address auditor) external view returns (bool);
    function incrementCredentialCount(address auditor) external;
    function setProofVerifier(address _proofVerifier) external;
}

interface IZKVerifier {
    struct ProofPayload {
        bytes32 proofId;
        address issuer;
        address subject;
        bytes proof;
        bytes signature;
    }

    function verifyProof(ProofPayload calldata payload, uint256[] calldata publicInputs) external returns (bool);
}

/**
 * @title ProofVerifier
 * @dev Smart contract for managing verifiable audit credentials on Polygon Amoy
 * @notice This contract handles credential anchoring and verification status
 */
contract ProofVerifier {
    address public admin;
    IAuditorRegistry public auditorRegistry;
    IZKVerifier public zkVerifier;
    mapping(address => bool) public verified;
    mapping(bytes32 => bool) public credentialAnchored;
    mapping(bytes32 => bool) public proofValidated;
    mapping(address => address) public projectAuditor;
    mapping(bytes32 => CredentialData) public credentials;
    mapping(bytes32 => ProofRecord) public proofRecords;
    
    struct CredentialData {
        bytes32 id;
        address issuer;
        bytes32 summaryHash;
        uint256 timestamp;
        bytes signature;
    }
    
    // Events
    event CredentialIssued(
        bytes32 indexed id,
        address indexed issuer,
        address indexed subject,
        bytes32 summaryHash,
        uint256 timestamp
    );
    
    event CredentialAnchored(
        bytes32 indexed id,
        address indexed issuer,
        bytes32 summaryHash,
        uint256 timestamp
    );
    
    event AuditVerified(
        address indexed project,
        address indexed auditor,
        string status,
        uint256 timestamp
    );

    event ProofValidated(
        bytes32 indexed proofId,
        bytes32 indexed credentialId,
        address indexed project,
        address auditor,
        bytes32 summaryHash,
        uint256 timestamp
    );
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyValidAddress(address addr) {
        require(addr != address(0), "Invalid address");
        _;
    }
    
    modifier onlyApprovedAuditor() {
        require(address(auditorRegistry) != address(0), "Auditor registry not configured");
        require(auditorRegistry.isApprovedAuditor(msg.sender), "Not an approved auditor");
        _;
    }
    
    constructor(address _auditorRegistry, address _zkVerifier) {
        admin = msg.sender;
        auditorRegistry = IAuditorRegistry(_auditorRegistry);
        if (_zkVerifier != address(0)) {
            zkVerifier = IZKVerifier(_zkVerifier);
        }
    }
    struct ProofRecord {
        address project;
        address auditor;
        bytes32 summaryHash;
        uint256 timestamp;
    }

    function setZKVerifier(address _zkVerifier) external onlyAdmin {
        require(_zkVerifier != address(0), "Invalid verifier address");
        zkVerifier = IZKVerifier(_zkVerifier);
    }

    
    /**
     * @dev Issue and anchor a credential on-chain (only approved auditors)
     * @param id Unique credential identifier
     * @param subject Address of the project receiving the credential
     * @param summaryHash Hash of the audit summary
     * @param signature Auditor's ECDSA signature (r, s, v format)
     */
    function issueCredential(
        bytes32 id,
        address subject,
        bytes32 summaryHash,
        bytes calldata signature
    ) external onlyApprovedAuditor onlyValidAddress(subject) {
        require(!credentialAnchored[id], "Credential already issued");
        require(id != bytes32(0), "Invalid credential ID");
        require(summaryHash != bytes32(0), "Invalid summary hash");
        require(signature.length == 65, "Invalid signature length");
        
        // Domain-separated signature to prevent replay across chains/contracts.
        bytes32 messageHash = keccak256(
            abi.encode(address(this), block.chainid, id, subject, summaryHash)
        );
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        // Recover signer from signature (ECDSA signature format: 65 bytes)
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }
        
        // Adjust v (27 or 28)
        if (v < 27) {
            v += 27;
        }
        
        address signer = ecrecover(ethSignedMessageHash, v, r, s);
        require(signer == msg.sender && signer != address(0), "Invalid signature");
        
        credentials[id] = CredentialData({
            id: id,
            issuer: msg.sender,
            summaryHash: summaryHash,
            timestamp: block.timestamp,
            signature: signature
        });
        
        credentialAnchored[id] = true;
        
        // Increment auditor's credential count
        if (address(auditorRegistry) != address(0)) {
            auditorRegistry.incrementCredentialCount(msg.sender);
        }
        
        emit CredentialIssued(id, msg.sender, subject, summaryHash, block.timestamp);
    }
    
    /**
     * @dev Anchor a credential on-chain (legacy method for backward compatibility)
     * @param id Unique credential identifier
     * @param summaryHash Hash of the audit summary
     * @param issuer Address of the credential issuer (auditor)
     */
    function anchorCredential(
        bytes32 id,
        bytes32 summaryHash,
        address issuer
    ) external onlyValidAddress(issuer) onlyApprovedAuditor {
        require(issuer == msg.sender, "Can only anchor for yourself");
        require(!credentialAnchored[id], "Credential already anchored");
        require(id != bytes32(0), "Invalid credential ID");
        require(summaryHash != bytes32(0), "Invalid summary hash");
        
        credentials[id] = CredentialData({
            id: id,
            issuer: issuer,
            summaryHash: summaryHash,
            timestamp: block.timestamp,
            signature: "" // No explicit signature stored for direct anchoring
        });
        
        credentialAnchored[id] = true;
        
        // Increment auditor's credential count
        if (address(auditorRegistry) != address(0)) {
            auditorRegistry.incrementCredentialCount(issuer);
        }
        
        emit CredentialAnchored(id, issuer, summaryHash, block.timestamp);
    }
    
    /**
     * @dev Record verification status for a project
     * @param project Address of the project being verified
     * @param auditor Address of the auditor
     * @param status Verification status string
     */
    function recordVerification(
        address project,
        address auditor,
        string calldata status,
        bytes32 credentialId,
        bytes32 proofId,
        bytes calldata proof,
        uint256[] calldata publicInputs,
        bytes calldata proofSignature
    ) external onlyValidAddress(project) onlyValidAddress(auditor) {
        require(bytes(status).length > 0, "Status cannot be empty");
        require(address(zkVerifier) != address(0), "Verifier not configured");
        require(!proofValidated[proofId], "Proof already used");
        require(publicInputs.length >= 3, "Invalid proof inputs");

        require(credentialId != bytes32(0), "Invalid credential id");
        require(credentialAnchored[credentialId], "Credential not anchored");
        CredentialData memory credential = credentials[credentialId];
        require(credential.issuer == auditor, "Auditor mismatch");

        // Validate public inputs
        require(publicInputs[0] == uint256(uint160(project)), "Project mismatch");
        require(publicInputs[1] == uint256(uint160(auditor)), "Auditor input mismatch");
        require(publicInputs[2] == uint256(credential.summaryHash), "Summary hash mismatch");

        IZKVerifier.ProofPayload memory payload = IZKVerifier.ProofPayload({
            proofId: proofId,
            issuer: auditor,
            subject: project,
            proof: proof,
            signature: proofSignature
        });

        bool verifiedProof = zkVerifier.verifyProof(payload, publicInputs);
        require(verifiedProof, "Proof verification failed");

        proofValidated[proofId] = true;

        proofRecords[proofId] = ProofRecord({
            project: project,
            auditor: auditor,
            summaryHash: credential.summaryHash,
            timestamp: block.timestamp
        });
        
        verified[project] = true;
        projectAuditor[project] = auditor;
        
        emit ProofValidated(proofId, credentialId, project, auditor, credential.summaryHash, block.timestamp);
        emit AuditVerified(project, auditor, status, block.timestamp);
    }
    
    /**
     * @dev Check if a project is verified
     * @param project Address of the project to check
     * @return bool True if project is verified, false otherwise
     */
    function isVerified(address project) external view returns (bool) {
        return verified[project];
    }
    
    /**
     * @dev Get auditor for a verified project
     * @param project Address of the project
     * @return address Auditor address, or zero address if not verified
     */
    function getAuditor(address project) external view returns (address) {
        return projectAuditor[project];
    }
    
    /**
     * @dev Check if a credential is anchored
     * @param id Credential ID to check
     * @return bool True if anchored, false otherwise
     */
    function isCredentialAnchored(bytes32 id) external view returns (bool) {
        return credentialAnchored[id];
    }
    
    /**
     * @dev Get credential data
     * @param id Credential ID
     * @return CredentialData struct with credential details
     */
    function getCredential(bytes32 id) external view returns (CredentialData memory) {
        return credentials[id];
    }
    
    /**
     * @dev Update auditor registry address
     * @param _auditorRegistry New auditor registry address
     */
    function setAuditorRegistry(address _auditorRegistry) external onlyAdmin {
        require(_auditorRegistry != address(0), "Invalid registry address");
        auditorRegistry = IAuditorRegistry(_auditorRegistry);
    }

    /**
     * @dev Transfer admin role
     * @param newAdmin Address of the new admin
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin address");
        admin = newAdmin;
    }
}
