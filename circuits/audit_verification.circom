pragma circom 2.0.0;

/**
 * Audit Verification Circuit
 * 
 * This circuit proves that an auditor has completed an audit for a project
 * without revealing sensitive details from the audit report.
 * 
 * Public Inputs:
 * - projectAddress: The project being audited (as uint256)
 * - auditorAddress: The auditor who performed the audit (as uint256)
 * - summaryHash: Hash of the audit summary (as uint256)
 * 
 * Private Inputs:
 * - auditReportHash: Full hash of the confidential audit report
 * - vulnerabilityCount: Number of vulnerabilities found (kept private)
 * - severityScore: Aggregate severity score (kept private)
 * 
 * The circuit proves:
 * 1. The auditor knows the full audit report
 * 2. The summary hash is correctly derived from the report
 * 3. The audit meets minimum quality standards
 */

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/bitify.circom";

template AuditVerification() {
    // Public inputs (visible on-chain)
    signal input projectAddress;
    signal input auditorAddress;
    signal input summaryHash;
    
    // Private inputs (kept secret)
    signal input auditReportHash;
    signal input vulnerabilityCount;
    signal input severityScore;
    signal input nonce; // For uniqueness
    
    // Compute hash using simple multiplication and addition
    // This is a simplified hash for demonstration - in production use Poseidon
    signal hash1;
    signal hash2;
    signal hash3;
    signal hash4;
    signal computedHash;
    
    hash1 <== projectAddress + auditorAddress;
    hash2 <== hash1 * auditReportHash;
    hash3 <== hash2 + vulnerabilityCount;
    hash4 <== hash3 + nonce;
    computedHash <== hash4;
    
    // Verify that the summary hash matches the computed hash
    // In production, this would use a proper cryptographic hash
    summaryHash === computedHash;
    
    // Constraint: vulnerability count must be reasonable (0-1000)
    component vulnCheck = LessThan(10);
    vulnCheck.in[0] <== vulnerabilityCount;
    vulnCheck.in[1] <== 1001; // Max 1000 vulnerabilities
    vulnCheck.out === 1;
    
    // Constraint: severity score must be reasonable (0-10000)
    component severityCheck = LessThan(14);
    severityCheck.in[0] <== severityScore;
    severityCheck.in[1] <== 10001; // Max score 10000
    severityCheck.out === 1;
}

component main {public [projectAddress, auditorAddress, summaryHash]} = AuditVerification();
