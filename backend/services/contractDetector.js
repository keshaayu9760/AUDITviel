/**
 * AuditViel — Polygon Amoy | Auditable Zero-Knowledge Verification Layer
 * 
 * Contract Detection Service: Automatically extracts contract addresses from
 * auditor's work history (GitHub repos, Code4rena findings, Immunefi submissions).
 */

const axios = require('axios');
const { ethers } = require('ethers');
class ContractDetector {
  constructor() {
    this.githubToken = process.env.GITHUB_API_TOKEN;
    this.ethereumAddressRegex = /0x[a-fA-F0-9]{40}/g;
  }

  /**
   * Extract Ethereum addresses from text
   */
  extractAddresses(text) {
    if (!text) return [];
    const matches = text.match(this.ethereumAddressRegex) || [];
    // Validate addresses and remove duplicates
    const validAddresses = matches
      .map(addr => addr.toLowerCase())
      .filter(addr => ethers.isAddress(addr))
      .filter((addr, index, self) => self.indexOf(addr) === index);
    return validAddresses;
  }

  /**
   * Fetch and parse GitHub audit repository files
   */
  async fetchGitHubRepoContent(repoUrl, githubHandle) {
    try {
      // Convert github.com/username/repo to API endpoint
      const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!repoMatch) return [];

      const [, owner, repo] = repoMatch;
      const headers = this.githubToken
        ? { Authorization: `token ${this.githubToken}` }
        : {};

      // Search for common audit report files
      const searchFiles = ['README.md', 'AUDIT.md', 'audit-report.md', 'report.md', 'SECURITY.md'];
      const contractAddresses = [];

      for (const fileName of searchFiles) {
        try {
          const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`,
            { headers }
          );

          if (response.data.content) {
            const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
            const addresses = this.extractAddresses(content);
            contractAddresses.push(...addresses);
          }
        } catch (e) {
          // File doesn't exist, continue
          continue;
        }
      }

      // Also search repository code for contract addresses
      try {
        const codeSearch = await axios.get(
          `https://api.github.com/search/code`,
          {
            headers,
            params: {
              q: `repo:${owner}/${repo} extension:md 0x`,
              per_page: 10
            }
          }
        );

        for (const item of codeSearch.data.items || []) {
          try {
            const fileResponse = await axios.get(item.url, { headers });
            if (fileResponse.data.content) {
              const content = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');
              const addresses = this.extractAddresses(content);
              contractAddresses.push(...addresses);
            }
          } catch (e) {
            continue;
          }
        }
      } catch (e) {
        // Code search failed, continue
      }

      return [...new Set(contractAddresses)];
    } catch (error) {
      console.error(`Error fetching GitHub repo content: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract contract addresses from Code4rena findings
   */
  async extractFromCode4rena(code4renaHandle, findings) {
    const addresses = [];

    for (const finding of findings || []) {
      // Extract from finding title and description
      if (finding.title) {
        addresses.push(...this.extractAddresses(finding.title));
      }
      if (finding.description) {
        addresses.push(...this.extractAddresses(finding.description));
      }
      // Code4rena findings often reference contest addresses
      if (finding.contest && finding.contest.toLowerCase().includes('0x')) {
        addresses.push(...this.extractAddresses(finding.contest));
      }
    }

    return [...new Set(addresses)];
  }

  /**
   * Extract contract addresses from Immunefi submissions
   */
  async extractFromImmunefi(immunefiHandle, submissions) {
    const addresses = [];

    for (const submission of submissions || []) {
      if (submission.project) {
        addresses.push(...this.extractAddresses(submission.project));
      }
      if (submission.description) {
        addresses.push(...this.extractAddresses(submission.description));
      }
    }

    return [...new Set(addresses)];
  }

  /**
   * Get all contracts worked on by an auditor
   */
  async getAuditorContracts(auditorInfo, reputationData) {
    const contractAddresses = new Set();

    // Extract from GitHub repositories
    if (auditorInfo.githubHandle && reputationData.github) {
      for (const repo of reputationData.github.repos || []) {
        if (repo.url) {
          const addresses = await this.fetchGitHubRepoContent(repo.url, auditorInfo.githubHandle);
          addresses.forEach(addr => contractAddresses.add(addr.toLowerCase()));
        }
      }
    }

    // Extract from Code4rena findings
    if (reputationData.code4rena) {
      const code4renaAddresses = await this.extractFromCode4rena(
        auditorInfo.code4renaHandle,
        reputationData.code4rena.findings
      );
      code4renaAddresses.forEach(addr => contractAddresses.add(addr.toLowerCase()));
    }

    // Extract from Immunefi submissions
    if (reputationData.immunefi) {
      const immunefiAddresses = await this.extractFromImmunefi(
        auditorInfo.immunefiHandle,
        reputationData.immunefi.submissions
      );
      immunefiAddresses.forEach(addr => contractAddresses.add(addr.toLowerCase()));
    }

    // Get on-chain credentials issued by this auditor
    // This would require querying the contract for all credentials
    // For now, return the extracted addresses

    return Array.from(contractAddresses).map(addr => ({
      address: addr,
      source: 'work-history',
      verified: false // Would need to verify on-chain
    }));
  }

  /**
   * Verify if an address is a valid contract on-chain
   */
  async verifyContractAddress(address, chainId = 80002) {
    try {
      const rpcUrl = process.env.RPC_URL || 'https://rpc-amoy.polygon.technology';
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const code = await provider.getCode(address);
      return code !== '0x' && code !== '0x0';
    } catch (error) {
      console.error(`Error verifying contract ${address}:`, error.message);
      return false;
    }
  }

  /**
   * Enrich contract addresses with verification status
   */
  async enrichContractAddresses(addresses) {
    const enriched = await Promise.all(
      addresses.map(async (contract) => {
        const isContract = await this.verifyContractAddress(contract.address);
        return {
          ...contract,
          verified: isContract,
          isContract
        };
      })
    );

    return enriched.filter(c => c.isContract || c.verified);
  }
}

module.exports = new ContractDetector();


