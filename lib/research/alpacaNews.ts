import crypto from "node:crypto";
import { getEnv, isAlpacaConfigured, type AppEnv } from "@/lib/config/env";
import type { NewsArticle } from "@/lib/types/trading";

type AlpacaNewsResponse = {
  news?: Array<Record<string, unknown>>;
  next_page_token?: string;
};

export class AlpacaNewsClient {
  private readonly env: AppEnv;

  constructor(env = getEnv()) {
    this.env = env;
  }

  async getNews(options: {
    symbols?: string[];
    start: Date;
    end?: Date;
    limit: number;
    includeContent?: boolean;
  }): Promise<NewsArticle[]> {
    if (!isAlpacaConfigured(this.env)) {
      throw new Error("Alpaca credentials are not configured for news research.");
    }

    const url = new URL("/v1beta1/news", this.env.ALPACA_DATA_BASE_URL);
    url.searchParams.set("start", options.start.toISOString());
    if (options.end) url.searchParams.set("end", options.end.toISOString());
    url.searchParams.set("sort", "desc");
    url.searchParams.set("limit", String(Math.min(50, Math.max(1, options.limit))));
    url.searchParams.set("include_content", options.includeContent ? "true" : "false");
    url.searchParams.set("exclude_contentless", "false");
    if (options.symbols && options.symbols.length > 0) {
      url.searchParams.set("symbols", options.symbols.join(","));
    }

    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": this.env.APCA_API_KEY_ID,
        "APCA-API-SECRET-KEY": this.env.APCA_API_SECRET_KEY
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Alpaca news request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as AlpacaNewsResponse;
    return (payload.news ?? []).map(mapNewsArticle).filter((article): article is NewsArticle => Boolean(article));
  }
}

export function newsContentHash(article: Pick<NewsArticle, "headline" | "summary" | "content" | "url">): string {
  return crypto
    .createHash("sha256")
    .update([article.headline, article.summary ?? "", article.content ?? "", article.url].join("\n"))
    .digest("hex");
}

function mapNewsArticle(raw: Record<string, unknown>): NewsArticle | undefined {
  const headline = toOptionalString(raw.headline);
  const url = toOptionalString(raw.url);
  const createdAt = toOptionalString(raw.created_at) ?? toOptionalString(raw.updated_at);
  if (!headline || !url || !createdAt) return undefined;

  const symbols = Array.isArray(raw.symbols)
    ? raw.symbols.map((symbol) => String(symbol).toUpperCase()).filter(Boolean)
    : [];

  return {
    id: toOptionalString(raw.id) ?? newsContentHash({ headline, url }),
    source: toOptionalString(raw.source) ?? "alpaca_news",
    url,
    headline,
    summary: toOptionalString(raw.summary),
    content: toOptionalString(raw.content),
    symbols,
    createdAt,
    updatedAt: toOptionalString(raw.updated_at)
  };
}

function toOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}
