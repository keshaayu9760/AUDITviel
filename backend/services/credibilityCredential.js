/**
 * AuditViel — Polygon Amoy | Auditable Zero-Knowledge Verification Layer
 * 
 * Credibility Credential Service: Issues verifiable credibility credentials
 * to auditors upon approval using local credential generation.
 */

const { randomUUID } = require('crypto');

class CredibilityCredentialService {
  constructor() {
    // Local credential generation - no external dependencies
  }

  /**
   * Issue a credibility credential for an auditor
   * This proves the auditor's trustworthiness and qualifications
   */
  async issueCredibilityCredential(auditorAddress, auditorInfo, reputationData) {
    try {
      const credibilityScore = reputationData.credibilityScore || 0;

      // Calculate credibility level
      let credibilityLevel = 'New';
      if (credibilityScore >= 800) credibilityLevel = 'Elite';
      else if (credibilityScore >= 600) credibilityLevel = 'Expert';
      else if (credibilityScore >= 400) credibilityLevel = 'Experienced';
      else if (credibilityScore >= 200) credibilityLevel = 'Emerging';

      // Generate credibility credential locally
      const credentialId = `auditviel-credibility-${randomUUID()}`;
      const issuedAt = new Date().toISOString();

      console.log('[Credibility] Issuing credential for auditor:', auditorAddress);
      console.log('[Credibility] Score:', credibilityScore, 'Level:', credibilityLevel);

      const credential = {
        credential_id: credentialId,
        issued_at: issuedAt,
        issuer: process.env.ADMIN_ADDRESS || 'AuditViel',
        subject: auditorAddress,
        type: 'AuditorCredibility',
        status: 'Approved',
        metadata: {
          name: 'AuditViel Auditor Credibility Credential',
          issuer_address: process.env.ADMIN_ADDRESS,
          credibility_score: credibilityScore,
          credibility_level: credibilityLevel,
          github_handle: auditorInfo.githubHandle || '',
          code4rena_handle: auditorInfo.code4renaHandle || '',
          immunefi_handle: auditorInfo.immunefiHandle || '',
          github_repos: reputationData.github?.count || 0,
          code4rena_findings: reputationData.code4rena?.count || 0,
          immunefi_bounties: reputationData.immunefi?.count || 0,
          approved_at: new Date(auditorInfo.approvedAt).toISOString()
        }
      };

      return {
        success: true,
        credential,
        credentialId
      };
    } catch (error) {
      console.error('Error issuing credibility credential:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get credibility credential for an auditor
   */
  async getCredibilityCredential(auditorAddress) {
    try {
      // In a real implementation, this would query a database or on-chain storage
      // For now, return null as credentials are issued on approval
      return null;
    } catch (error) {
      console.error('Error getting credibility credential:', error.message);
      return null;
    }
  }
}

module.exports = new CredibilityCredentialService();
