// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AuditorRegistry
 * @dev Registry for managing approved auditors with credibility tracking
 * @notice Only approved auditors can issue credentials
 */
contract AuditorRegistry {
    address public admin;
    address public proofVerifier;
    
    struct AuditorInfo {
        bool isApproved;
        uint256 approvedAt;
        uint256 credentialCount;
        string githubHandle;
        string code4renaHandle;
        string immunefiHandle;
        uint256 credibilityScore;
    }
    
    mapping(address => AuditorInfo) public auditors;
    address[] public auditorList;
    
    event AuditorApproved(address indexed auditor, uint256 timestamp);
    event AuditorRevoked(address indexed auditor, uint256 timestamp);
    event AuditorProfileUpdated(address indexed auditor, string githubHandle, string code4renaHandle, string immunefiHandle);
    event CredibilityScoreUpdated(address indexed auditor, uint256 newScore);
    event CredentialIssued(address indexed auditor);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier onlyApprovedAuditor() {
        require(auditors[msg.sender].isApproved, "Not an approved auditor");
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
    /**
     * @dev Set the authorized ProofVerifier contract
     * @param _proofVerifier Address of the ProofVerifier
     */
    function setProofVerifier(address _proofVerifier) external onlyAdmin {
        require(_proofVerifier != address(0), "Invalid proof verifier address");
        proofVerifier = _proofVerifier;
    }
    
    /**
     * @dev Approve an auditor to issue credentials
     * @param auditor Address of the auditor to approve
     */
    function approveAuditor(address auditor) external onlyAdmin {
        require(auditor != address(0), "Invalid auditor address");
        require(!auditors[auditor].isApproved, "Auditor already approved");
        
        auditors[auditor] = AuditorInfo({
            isApproved: true,
            approvedAt: block.timestamp,
            credentialCount: 0,
            githubHandle: "",
            code4renaHandle: "",
            immunefiHandle: "",
            credibilityScore: 0
        });
        
        auditorList.push(auditor);
        
        emit AuditorApproved(auditor, block.timestamp);
    }
    
    /**
     * @dev Revoke an auditor's approval
     * @param auditor Address of the auditor to revoke
     */
    function revokeAuditor(address auditor) external onlyAdmin {
        require(auditors[auditor].isApproved, "Auditor not approved");
        
        auditors[auditor].isApproved = false;
        
        emit AuditorRevoked(auditor, block.timestamp);
    }
    
    /**
     * @dev Update auditor's profile with external handles
     * @param githubHandle GitHub username
     * @param code4renaHandle Code4rena username
     * @param immunefiHandle Immunefi username
     */
    function updateAuditorProfile(
        string calldata githubHandle,
        string calldata code4renaHandle,
        string calldata immunefiHandle
    ) external onlyApprovedAuditor {
        require(bytes(githubHandle).length > 0, "GitHub handle required");
        
        AuditorInfo storage info = auditors[msg.sender];
        info.githubHandle = githubHandle;
        info.code4renaHandle = code4renaHandle;
        info.immunefiHandle = immunefiHandle;
        
        emit AuditorProfileUpdated(msg.sender, githubHandle, code4renaHandle, immunefiHandle);
    }
    
    /**
     * @dev Update auditor's credibility score (called by admin or automation)
     * @param auditor Address of the auditor
     * @param score New credibility score
     */
    function updateCredibilityScore(address auditor, uint256 score) external onlyAdmin {
        require(auditor != address(0), "Invalid auditor address");
        require(auditors[auditor].isApproved, "Auditor not approved");
        
        auditors[auditor].credibilityScore = score;
        
        emit CredibilityScoreUpdated(auditor, score);
    }
    
    /**
     * @dev Increment credential count for an auditor (called by ProofVerifier)
     * @param auditor Address of the auditor
     */
    function incrementCredentialCount(address auditor) external {
        require(msg.sender == proofVerifier, "Only ProofVerifier can increment");
        require(auditor != address(0), "Invalid auditor address");
        require(auditors[auditor].isApproved, "Auditor not approved");
        
        auditors[auditor].credentialCount++;
        
        emit CredentialIssued(auditor);
    }
    
    /**
     * @dev Check if an address is an approved auditor
     * @param auditor Address to check
     * @return bool True if approved, false otherwise
     */
    function isApprovedAuditor(address auditor) external view returns (bool) {
        return auditors[auditor].isApproved;
    }
    
    /**
     * @dev Get auditor information
     * @param auditor Address of the auditor
     * @return AuditorInfo struct with all auditor details
     */
    function getAuditorInfo(address auditor) external view returns (AuditorInfo memory) {
        return auditors[auditor];
    }
    
    /**
     * @dev Get list of all auditors
     * @return address[] Array of auditor addresses
     */
    function getAllAuditors() external view returns (address[] memory) {
        return auditorList;
    }
    
    /**
     * @dev Get count of approved auditors
     * @return uint256 Number of approved auditors
     */
    function getApprovedAuditorCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < auditorList.length; i++) {
            if (auditors[auditorList[i]].isApproved) {
                count++;
            }
        }
        return count;
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
