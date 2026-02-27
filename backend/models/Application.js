const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema(
  {
    wallet: { type: String, required: true, index: true },
    github: String,
    code4rena: String,
    immunefi: String,
    message: String,
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminNotes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", ApplicationSchema);
