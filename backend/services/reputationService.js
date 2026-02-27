/**
 * AuditViel — Polygon Amoy | Auditable Zero-Knowledge Verification Layer
 * 
 * Reputation Service: Fetches and aggregates auditor reputation data from
 * GitHub, Code4rena, and Immunefi. Calculates credibility scores (0-100).
 */

const axios = require('axios');
const { ethers } = require('ethers');

class ReputationService {
  constructor() {
    this.githubToken = process.env.GITHUB_API_TOKEN;
    this.cache = new Map();
    this.cacheTimeout = 3600000; // 1 hour

    const signerKey = process.env.CREDIBILITY_SIGNER_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY;
    if (signerKey) {
      try {
        this.credibilitySigner = new ethers.Wallet(this.normalizeKey(signerKey));
      } catch (err) {
        console.error('Failed to initialize credibility signer:', err.message);
      }
    }
  }

  normalizeKey(raw) {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (trimmed.startsWith('0x')) return trimmed;
    return `0x${trimmed}`;
  }

  /**
   * Get cached data or fetch new
   */
  async getCached(key, fetchFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const data = await fetchFn();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Fetch GitHub audit repositories
   */
  async fetchGitHubAudits(githubHandle) {
    if (!githubHandle) return { repos: [], count: 0, contributions: 0 };

    try {
      return await this.getCached(`github:${githubHandle}`, async () => {
        const headers = this.githubToken
          ? { Authorization: `token ${this.githubToken}` }
          : {};

        // Search for audit-related repos
        const response = await axios.get(
          `https://api.github.com/users/${githubHandle}/repos`,
          { headers, params: { per_page: 100, sort: 'updated' } }
        );

        const auditRepos = response.data.filter(repo =>
          repo.name.toLowerCase().includes('audit') ||
          repo.description?.toLowerCase().includes('audit') ||
          repo.description?.toLowerCase().includes('security')
        );

        // Fetch contribution activity (last 90 days)
        let contributions = 0;
        try {
          const eventsResponse = await axios.get(
            `https://api.github.com/users/${githubHandle}/events/public`,
            { headers, params: { per_page: 100 } }
          );

          const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
          contributions = eventsResponse.data.filter((event) => {
            const created = new Date(event.created_at).getTime();
            return created >= ninetyDaysAgo;
          }).length;
        } catch (eventErr) {
          console.warn(`GitHub events fetch error for ${githubHandle}:`, eventErr.message);
        }

        return {
          repos: auditRepos.map(r => ({
            name: r.name,
            description: r.description,
            url: r.html_url,
            stars: r.stargazers_count,
            updated: r.updated_at
          })),
          count: auditRepos.length,
          contributions
        };
      });
    } catch (error) {
      console.error(`GitHub fetch error for ${githubHandle}:`, error.message);
      return { repos: [], count: 0, contributions: 0, error: error.message };
    }
  }

  /**
   * Fetch Code4rena findings (mock implementation)
   * In production, scrape or use API if available
   */
  async fetchCode4renaFindings(code4renaHandle) {
    if (!code4renaHandle) return { findings: [], count: 0 };

    try {
      return await this.getCached(`code4rena:${code4renaHandle}`, async () => {
        // Mock data - in production, scrape https://code4rena.com/@{handle}
        // or use API if available
        // Experimental API endpoint; falls back to zero if unavailable
        const response = await axios.get(`https://code4rena.com/api/users/${code4renaHandle}`);
        const findings = (response.data?.findings || []).map((finding) => ({
          contest: finding.contest || 'Unknown Contest',
          severity: finding.severity || 'INFO',
          title: finding.title || 'Finding',
          date: finding.date || finding.created_at || 'Unknown'
        }));

        return {
          findings,
          count: findings.length,
          profileUrl: `https://code4rena.com/@${code4renaHandle}`
        };
      });
    } catch (error) {
      console.error(`Code4rena fetch error for ${code4renaHandle}:`, error.message);
      return { findings: [], count: 0, error: error.message };
    }
  }

  /**
   * Fetch Immunefi bounties (mock implementation)
   */
  async fetchImmunefiSubmissions(immunefiHandle) {
    if (!immunefiHandle) return { submissions: [], count: 0 };

    try {
      return await this.getCached(`immunefi:${immunefiHandle}`, async () => {
        // Mock data - in production, scrape or use API
        const response = await axios.get(`https://immunefi.com/api/profile/${immunefiHandle}`);
        const submissions = (response.data?.submissions || []).map((submission) => ({
          project: submission.project || 'Unknown Project',
          severity: submission.severity || 'LOW',
          bounty: submission.bounty || submission.reward || 'Undisclosed',
          date: submission.date || submission.created_at || 'Unknown'
        }));

        return {
          submissions,
          count: submissions.length,
          profileUrl: `https://immunefi.com/profile/${immunefiHandle}`
        };
      });
    } catch (error) {
      console.error(`Immunefi fetch error for ${immunefiHandle}:`, error.message);
      return { submissions: [], count: 0, error: error.message };
    }
  }

  /**
   * Calculate credibility score based on all data
   */
  calculateCredibilityScore(data) {
    let score = 0;

    const githubContrib = data.github?.contributions || 0;
    const githubRepos = data.github?.count || 0;
    const githubScore = Math.min((githubContrib * 0.5) + (githubRepos * 4), 35);

    const code4renaFindings = data.code4rena?.findings || [];
    const highSeverity = code4renaFindings.filter((f) => f.severity === 'HIGH').length;
    const mediumSeverity = code4renaFindings.filter((f) => f.severity === 'MEDIUM').length;
    const code4renaScore = Math.min(highSeverity * 6 + mediumSeverity * 3 + (code4renaFindings.length * 1), 30);

    const immunefiScore = Math.min((data.immunefi?.count || 0) * 5, 20);

    const credentialScore = Math.min((data.onChainCredentials || 0) * 2, 10);

    let tenureScore = 0;
    if (data.approvedAt) {
      const monthsActive = Math.floor((Date.now() - data.approvedAt) / (30 * 24 * 60 * 60 * 1000));
      tenureScore = Math.min(monthsActive, 5);
    }

    score = githubScore + code4renaScore + immunefiScore + credentialScore + tenureScore;
    return Math.min(Math.round(score), 100);
  }

  /**
   * Get complete reputation data for an auditor
   */
  async getAuditorReputation(auditorInfo) {
    const [github, code4rena, immunefi] = await Promise.all([
      this.fetchGitHubAudits(auditorInfo.githubHandle),
      this.fetchCode4renaFindings(auditorInfo.code4renaHandle),
      this.fetchImmunefiSubmissions(auditorInfo.immunefiHandle)
    ]);

    const reputationData = {
      github,
      code4rena,
      immunefi,
      onChainCredentials: auditorInfo.credentialCount || 0,
      approvedAt: auditorInfo.approvedAt
    };

    const credibilityScore = this.calculateCredibilityScore(reputationData);
    let signature = null;
    if (this.credibilitySigner && auditorInfo.address) {
      const digest = ethers.solidityPackedKeccak256(
        ['string', 'address', 'uint8'],
        ['auditviel:credibility:v1', auditorInfo.address, credibilityScore]
      );
      signature = await this.credibilitySigner.signMessage(ethers.getBytes(digest));
    }

    return {
      ...reputationData,
      githubHandle: auditorInfo.githubHandle || null,
      code4renaHandle: auditorInfo.code4renaHandle || null,
      immunefiHandle: auditorInfo.immunefiHandle || null,
      credibilityScore,
      lastUpdated: new Date().toISOString(),
      signature
    };
  }

  /**
   * Clear cache for specific auditor
   */
  clearCache(githubHandle, code4renaHandle, immunefiHandle) {
    if (githubHandle) this.cache.delete(`github:${githubHandle}`);
    if (code4renaHandle) this.cache.delete(`code4rena:${code4renaHandle}`);
    if (immunefiHandle) this.cache.delete(`immunefi:${immunefiHandle}`);
  }
}

module.exports = new ReputationService();
