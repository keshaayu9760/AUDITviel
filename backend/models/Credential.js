const mongoose = require("mongoose");

const CredentialSchema = new mongoose.Schema(
  {
    credentialId: { type: String, unique: true, index: true },
    issuer: { type: String, required: true, index: true },
    subject: { type: String, required: true, index: true },
    summaryHash: { type: String, required: true },
    airkitId: String,
    anchored: { type: Boolean, default: false },
    txnHash: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Credential", CredentialSchema);



