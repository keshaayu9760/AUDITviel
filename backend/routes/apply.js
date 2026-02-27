/**
 * AuditViel — Polygon Amoy | Auditable Zero-Knowledge Verification Layer
 * 
 * Application submission routes for auditor onboarding.
 * Handles application storage and admin notifications.
 */

const express = require('express');
const { ethers } = require('ethers');
const nodemailer = require('nodemailer');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
const Application = require('../models/Application');

// helper: create application
async function createApplication(payload) {
  const app = new Application(payload);
  return await app.save();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Create email transporter (supports Gmail, custom SMTP, or console fallback)
 */
function createEmailTransporter() {
  // If SMTP config provided, use it
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Check if it's Outlook/Office 365
    const isOutlook = process.env.SMTP_HOST.includes('outlook') ||
      process.env.SMTP_HOST.includes('office365') ||
      process.env.SMTP_USER.includes('outlook');

    const transportOptions = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // Outlook/Office365 uses STARTTLS on port 587
      requireTLS: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    // Add TLS options for Outlook
    if (isOutlook) {
      transportOptions.tls = {
        rejectUnauthorized: process.env.SMTP_ALLOW_INSECURE_TLS === 'true' ? false : true,
        minVersion: 'TLSv1.2'
      };
    }

    return nodemailer.createTransport(transportOptions);
  }

  // Try Gmail if GMAIL_USER and GMAIL_APP_PASSWORD provided
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    // Remove any spaces or newlines from App Password
    const appPassword = process.env.GMAIL_APP_PASSWORD.trim().replace(/\s+/g, '');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER.trim(),
        pass: appPassword,
      },
    });
  }

  // Fallback: create test transporter (won't send but won't error)
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: 'test',
      pass: 'test',
    },
  });
}

/**
 * Send email notification to admin
 */
async function notifyAdmin(application) {
  const adminEmail = process.env.ADMIN_EMAIL || 'saklaniayush97@gmail.com';
  const websiteUrl = process.env.WEBSITE_URL || 'http://localhost:3000';
  const safeMessage = application.message
    ? escapeHtml(application.message).replace(/\n/g, '<br>')
    : '';

  // Log to console always
  console.log('\n📧 ============================================');
  console.log('📧 NEW AUDITOR APPLICATION RECEIVED');
  console.log('📧 ============================================');
  console.log(`📧 Wallet Address: ${application.walletAddress}`);
  console.log(`📧 GitHub: ${application.githubHandle || 'Not provided'}`);
  console.log(`📧 Code4rena: ${application.code4renaHandle || 'Not provided'}`);
  console.log(`📧 Immunefi: ${application.immunefiHandle || 'Not provided'}`);
  console.log(`📧 Message: ${application.message || 'None'}`);
  console.log(`📧 Submitted: ${application.submittedAt}`);
  console.log(`📧 ============================================\n`);

  try {
    const transporter = createEmailTransporter();

    // Check if we have real email config
    const hasEmailConfig = (process.env.SMTP_HOST || process.env.GMAIL_USER) &&
      (process.env.SMTP_USER || process.env.GMAIL_USER);

    if (hasEmailConfig) {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@auditviel.com',
        to: adminEmail,
        subject: '🔔 New Auditor Application - AuditViel',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6366f1;">New Auditor Application Received</h2>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Application Details:</h3>
              <p><strong>Wallet Address:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px;">${application.walletAddress}</code></p>
              <p><strong>GitHub Handle:</strong> ${application.githubHandle ? `<a href="https://github.com/${application.githubHandle}">${application.githubHandle}</a>` : 'Not provided'}</p>
              <p><strong>Code4rena Handle:</strong> ${application.code4renaHandle ? `<a href="https://code4rena.com/@${application.code4renaHandle}">${application.code4renaHandle}</a>` : 'Not provided'}</p>
              <p><strong>Immunefi Handle:</strong> ${application.immunefiHandle ? `<a href="https://immunefi.com/profile/${application.immunefiHandle}">${application.immunefiHandle}</a>` : 'Not provided'}</p>
              ${safeMessage ? `<p><strong>Message:</strong><br>${safeMessage}</p>` : ''}
              <p><strong>Submitted:</strong> ${new Date(application.submittedAt).toLocaleString()}</p>
            </div>
            <div style="margin: 20px 0;">
              <a href="${websiteUrl}/admin" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Review Application →
              </a>
            </div>
            <p style="color: #666; font-size: 12px;">
              This is an automated notification from AuditViel. Please review and approve or reject the application.
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully to ${adminEmail}`);
    } else {
      console.log(`⚠️  Email not configured. Application logged to console and stored in MongoDB.`);
      console.log(`💡 To enable emails, add SMTP config or GMAIL_USER/GMAIL_APP_PASSWORD to .env`);
    }
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    console.log('Application saved successfully, but email notification failed.');
    // Don't throw - application should still be saved even if email fails
  }
}

/**
 * POST /api/apply
 * Submit auditor application
 */
router.post('/', async (req, res) => {
  try {
    const { walletAddress, githubHandle, code4renaHandle, immunefiHandle, message } = req.body;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address format' });
    }
    if (!githubHandle && !code4renaHandle && !immunefiHandle) {
      return res.status(400).json({ success: false, error: 'Provide at least one platform handle' });
    }

    const normalizedWallet = ethers.getAddress(walletAddress).toLowerCase();

    try {
      const AuditorRegistryABI = require('../abi/AuditorRegistry.json');
      const registryAddress = process.env.AUDITOR_REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS;
      if (registryAddress) {
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://rpc-amoy.polygon.technology');
        const registry = new ethers.Contract(registryAddress, AuditorRegistryABI, provider);
        const isApproved = await registry.isApprovedAuditor(normalizedWallet);
        if (isApproved) {
          return res.status(400).json({
            success: false,
            error: 'Wallet already approved as auditor',
            alreadyApproved: true
          });
        }
      }
    } catch (error) {
      console.warn('Could not check approval status:', error.message);
    }

    const existing = await Application.findOne({ wallet: normalizedWallet, status: 'pending' });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Existing pending application' });
    }

    const applicationDoc = await createApplication({
      wallet: normalizedWallet,
      github: githubHandle,
      code4rena: code4renaHandle,
      immunefi: immunefiHandle,
      message
    });

    await notifyAdmin({
      walletAddress: normalizedWallet,
      githubHandle,
      code4renaHandle,
      immunefiHandle,
      message,
      submittedAt: applicationDoc.createdAt
    });

    res.json({
      success: true,
      message: 'Application submitted successfully. Admin will review it shortly.',
      applicationId: applicationDoc._id,
      application: applicationDoc
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ success: false, error: 'Failed to submit application', message: error.message });
  }
});

/**
 * GET /api/apply/pending
 * Get pending applications (admin only)
 */
router.get('/pending', adminAuth.requireAdmin, async (_req, res) => {
  try {
    const pending = await Application.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();

    // Transform database fields to match frontend expectations
    const transformedApplications = pending.map(app => ({
      ...app,
      walletAddress: app.wallet,
      githubHandle: app.github,
      code4renaHandle: app.code4rena,
      immunefiHandle: app.immunefi,
      submittedAt: app.createdAt,
      reviewedAt: app.updatedAt
    }));

    res.json({ success: true, count: transformedApplications.length, applications: transformedApplications });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch applications', message: error.message });
  }
});

/**
 * GET /api/apply/:address
 * Check application status for an address
 */
router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address format' });
    }
    const normalizedWallet = ethers.getAddress(address).toLowerCase();
    const application = await Application.findOne({ wallet: normalizedWallet }).lean();

    if (!application) {
      return res.json({ success: true, hasApplication: false, status: null });
    }

    res.json({
      success: true,
      hasApplication: true,
      status: application.status,
      submittedAt: application.createdAt,
      reviewedAt: application.updatedAt,
      adminNotes: application.adminNotes || null
    });
  } catch (error) {
    console.error('Error checking application status:', error);
    res.status(500).json({ success: false, error: 'Failed to check application status', message: error.message });
  }
});

module.exports = router;

