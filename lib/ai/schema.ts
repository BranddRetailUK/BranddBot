export const aiDecisionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: {
      type: "string",
      enum: ["buy", "sell", "hold", "block"],
      description: "The AI recommendation after reviewing the deterministic RSI signal and risk context."
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence in the recommendation from 0 to 1."
    },
    rationale: {
      type: "string",
      description: "Short explanation of the decision."
    },
    riskFlags: {
      type: "array",
      items: { type: "string" },
      description: "Specific market, data, or risk concerns."
    },
    learningUpdate: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        rewardSignal: {
          type: "number",
          minimum: -1,
          maximum: 1,
          description: "Learning reward estimate based on expected or observed return quality."
        },
        observations: {
          type: "array",
          items: { type: "string" }
        },
        mistakesToAvoid: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["summary", "rewardSignal", "observations", "mistakesToAvoid"]
    },
    recommendedParameterAdjustments: {
      type: "object",
      additionalProperties: false,
      properties: {
        rsiPeriod: { type: "number" },
        oversoldThreshold: { type: "number" },
        overboughtThreshold: { type: "number" },
        maxNotionalMultiplier: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "A multiplier that can only reduce the configured order size."
        }
      },
      required: ["rsiPeriod", "oversoldThreshold", "overboughtThreshold", "maxNotionalMultiplier"]
    }
  },
  required: ["decision", "confidence", "rationale", "riskFlags", "learningUpdate", "recommendedParameterAdjustments"]
} as const;
