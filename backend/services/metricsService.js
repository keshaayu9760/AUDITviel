const Metric = require("../models/Metric");

function average(items, key) {
  if (!items || !items.length) return 0;
  const filtered = items.map((i) => Number(i[key]) || 0).filter((v) => Number.isFinite(v));
  if (!filtered.length) return 0;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

module.exports = {
  logProofGeneration: async (data) => {
    const m = new Metric({
      type: "proofGeneration",
      durationMs: data.durationMs || 0,
      proofSizeBytes: data.proofSizeBytes || 0,
      success: data.success !== false,
      project: data.project || null,
      auditor: data.auditor || null,
      detail: data.detail || {}
    });
    await m.save();
    return m;
  },

  logProofVerification: async (data) => {
    const m = new Metric({
      type: "proofVerification",
      durationMs: data.durationMs || 0,
      gasUsed: data.gasUsed || 0,
      success: data.success !== false,
      project: data.project || null,
      auditor: data.auditor || null,
      detail: data.detail || {}
    });
    await m.save();
    return m;
  },

  getMetrics: async () => {
    const recent = await Metric.find({}).sort({ createdAt: -1 }).limit(200);
    const gen = recent.filter(r => r.type === "proofGeneration");
    const ver = recent.filter(r => r.type === "proofVerification");

    const successRate = (arr) => {
      if (!arr.length) return 0;
      const succ = arr.filter(a => a.success).length;
      return Number(((succ / arr.length) * 100).toFixed(2));
    };

    return {
      proofGeneration: {
        count: gen.length,
        averageMs: Math.round(average(gen, "durationMs")),
        recent: gen.slice(0, 10),
      },
      proofVerification: {
        count: ver.length,
        averageMs: Math.round(average(ver, "durationMs")),
        averageGas: Math.round(average(ver, "gasUsed")),
        successRate: successRate(ver),
        recent: ver.slice(0, 10),
      },
      summary: {
        proof_time_ms: Math.round(average(gen, "durationMs")),
        verify_gas: Math.round(average(ver, "gasUsed")),
        success_rate: successRate(ver),
        updated_at: new Date().toISOString()
      }
    };
  }
};


