import crypto from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import { aiDecisionJsonSchema } from "@/lib/ai/schema";
import { getEnv, isOpenAiConfigured, type AppEnv } from "@/lib/config/env";
import type { AiDecisionResult, AiTradingDecision, TradingContext } from "@/lib/types/trading";

type ResponsesCreate = (request: unknown) => Promise<{
  id?: string;
  output_text?: string;
}>;

const aiDecisionSchema = z.object({
  decision: z.enum(["buy", "sell", "hold", "block"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  riskFlags: z.array(z.string()),
  learningUpdate: z.object({
    summary: z.string(),
    rewardSignal: z.number().min(-1).max(1),
    observations: z.array(z.string()),
    mistakesToAvoid: z.array(z.string())
  }),
  recommendedParameterAdjustments: z.object({
    rsiPeriod: z.number().optional(),
    oversoldThreshold: z.number().optional(),
    overboughtThreshold: z.number().optional(),
    maxNotionalMultiplier: z.number().min(0).max(1).optional()
  })
});

export class AIReasoningService {
  private readonly env: AppEnv;
  private readonly responsesCreate?: ResponsesCreate;

  constructor(options?: { env?: AppEnv; responsesCreate?: ResponsesCreate }) {
    this.env = options?.env ?? getEnv();
    this.responsesCreate = options?.responsesCreate ?? this.createOpenAiClient();
  }

  async reason(context: TradingContext): Promise<AiDecisionResult> {
    const compactContext = this.compactContext(context);
    const inputJson = JSON.stringify(compactContext);
    const promptHash = hashPrompt(inputJson);

    if (!this.responsesCreate || !isOpenAiConfigured(this.env)) {
      return fallbackDecision({
        promptHash,
        inputJson,
        rationale: "OpenAI API key is not configured. AI-gated trade execution is blocked until credentials are provided."
      });
    }

    const request = this.createRequest(compactContext);

    try {
      const response = await this.responsesCreate(request);
      const parsed = parseAiDecision(response.output_text);
      return {
        ...parsed,
        configured: true,
        promptHash,
        inputJson,
        outputJson: response.output_text ?? "",
        openAiResponseId: response.id
      };
    } catch (error) {
      return fallbackDecision({
        promptHash,
        inputJson,
        rationale: `OpenAI reasoning failed: ${error instanceof Error ? error.message : "unknown error"}`
      });
    }
  }

  createRequest(compactContext: unknown): unknown {
    return {
      model: this.env.OPENAI_MODEL,
      store: this.env.OPENAI_STORE_RESPONSES,
      reasoning: {
        effort: this.env.OPENAI_REASONING_EFFORT
      },
      text: {
        verbosity: this.env.OPENAI_TEXT_VERBOSITY,
        format: {
          type: "json_schema",
          name: "trading_ai_decision",
          strict: true,
          schema: aiDecisionJsonSchema
        }
      },
      input: [
        {
          role: "system",
          content:
            "You are the reasoning layer for a paper-trading RSI bot. You may reduce confidence, hold, or block trades, but you must not override the deterministic RSI strategy or risk limits. Return only the requested structured JSON."
        },
        {
          role: "user",
          content: JSON.stringify(compactContext)
        }
      ]
    };
  }

  private createOpenAiClient(): ResponsesCreate | undefined {
    if (!isOpenAiConfigured(this.env)) return undefined;
    const client = new OpenAI({ apiKey: this.env.OPENAI_API_KEY });
    return (request) => client.responses.create(request as never) as never;
  }

  private compactContext(context: TradingContext) {
    return {
      symbol: context.symbol,
      generatedAt: context.generatedAt,
      currentPrice: context.currentPrice,
      barSummary: context.barSummary,
      rsi: context.rsi,
      deterministicSignal: context.deterministicSignal,
      position: context.position ?? null,
      account: {
        buyingPower: context.account.buyingPower,
        cash: context.account.cash,
        portfolioValue: context.account.portfolioValue
      },
      openPositionsCount: context.openPositionsCount,
      recentTrades: context.recentTrades.slice(0, 8),
      realizedPnlToday: context.realizedPnlToday,
      riskLimits: context.riskLimits,
      priorLessons: context.priorLessons.slice(0, 8)
    };
  }
}

export function parseAiDecision(outputText?: string): AiTradingDecision {
  if (!outputText) {
    throw new Error("OpenAI response did not include output_text.");
  }

  const raw = JSON.parse(outputText) as unknown;
  return aiDecisionSchema.parse(raw);
}

function fallbackDecision(params: { promptHash: string; inputJson: string; rationale: string }): AiDecisionResult {
  const decision: AiTradingDecision = {
    decision: "block",
    confidence: 0,
    rationale: params.rationale,
    riskFlags: ["ai_unavailable"],
    learningUpdate: {
      summary: "No learning update was applied because AI reasoning was unavailable.",
      rewardSignal: 0,
      observations: [],
      mistakesToAvoid: ["Do not place AI-gated trades without a valid model response."]
    },
    recommendedParameterAdjustments: {
      rsiPeriod: undefined,
      oversoldThreshold: undefined,
      overboughtThreshold: undefined,
      maxNotionalMultiplier: 0
    }
  };

  return {
    ...decision,
    configured: false,
    promptHash: params.promptHash,
    inputJson: params.inputJson,
    outputJson: JSON.stringify(decision)
  };
}

function hashPrompt(inputJson: string): string {
  return crypto.createHash("sha256").update(inputJson).digest("hex");
}
