const mongoose = require("mongoose");

const MetricSchema = new mongoose.Schema(
  {
    type: String, // proofGeneration | proofVerification | other
    durationMs: Number,
    gasUsed: Number,
    success: Boolean,
    project: String,
    auditor: String,
    detail: Object
  },
  { timestamps: true }
);

module.exports = mongoose.model("Metric", MetricSchema);



