const test = require("node:test");
const assert = require("node:assert/strict");
const { ethers } = require("ethers");

test("adminAuth issues and validates admin JWT", async () => {
  const adminWallet = ethers.Wallet.createRandom();
  process.env.ADMIN_ADDRESS = adminWallet.address;
  process.env.ADMIN_JWT_SECRET = "test-test-test-test-test-test-test-secret";

  const adminAuth = require("../middleware/adminAuth");
  const token = adminAuth.issueToken(adminWallet.address);

  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  let called = false;
  adminAuth.requireAdmin(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(req.admin.address, adminWallet.address.toLowerCase());
});
