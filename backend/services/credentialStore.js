const Credential = require("../models/Credential");

module.exports = {
  upsertCredential: async (data) => {
    if (!data || !data.credentialId) {
      throw new Error("credentialId required");
    }
    const { credentialId } = data;
    const filter = { credentialId };
    const update = { $set: data };
    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
    return await Credential.findOneAndUpdate(filter, update, opts);
  },

  getCredential: async (credentialId) => {
    if (!credentialId) return null;
    return await Credential.findOne({ credentialId });
  },

  listCredentials: async (limit = 100) => {
    return await Credential.find({}).sort({ createdAt: -1 }).limit(limit);
  }
};


