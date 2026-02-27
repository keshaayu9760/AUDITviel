const mongoose = require("mongoose");

const ProofRecordSchema = new mongoose.Schema(
  {
    proofId: { type: String, unique: true, required: true, index: true },
    credentialId: { type: String, required: true, index: true },
    project: { type: String, required: true },
    auditor: { type: String, required: true },
    proof: { type: String, required: true }, // bytes proof
    publicInputs: { type: [String], required: true }, // uint256[] publicInputs
    proofSignature: { type: String, required: true }, // bytes proofSignature (65 bytes, real cryptographic signature)
    validatedOnChain: { type: Boolean, default: false },
    txnHash: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProofRecord", ProofRecordSchema);


