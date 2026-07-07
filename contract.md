# CONTRACT_V1

repo:
  name: ai-rsi-trading-bot
  product_name: BranddBot
  description: AI-gated RSI paper-trading bot for US stocks/ETFs with outcome learning and source-backed research.
  status: paper_trading_research_auto_trade_dashboard_controls
  language: TypeScript
  module_system: ESM
  framework: Next.js App Router
  ui_runtime: React
  db: PostgreSQL via Prisma
  broker_primary: Alpaca Trading API paper account
  market_data_primary: Alpaca Market Data API, IEX feed
  ai_primary: OpenAI Responses API
  important: This repo is experimental paper-trading software, not financial advice.

agent_boot_contract:
  read_policy: Read this file once at chat start via AGENTS.md, then reread only when needed.
  update_policy: If features, logic, APIs, data models, environment variables, safety rules, scripts, or build/runtime behavior are added, removed, or materially changed, update this contract in the same turn.
  non_changelog_policy: This file describes the current build state only. Do not append chronological change notes.
  secret_policy: Never print or commit .env values or API keys.

package:
  scripts:
    dev: "next dev"
    start: "next start"
    build: "prisma generate && next build"
    lint: "eslint ."
    test: "vitest run"
    "test:watch": "vitest"
    "db:generate": "prisma generate"
    "db:push": "node scripts/db-push.mjs"
    "db:prisma-push": "prisma db push"
    "bot:scan": "node --import tsx scripts/run-scan.ts"
    "bot:worker": "node --import tsx scripts/worker.ts"
    "bot:reconcile": "node --import tsx scripts/reconcile-trades.ts"
    "research:crawl": "node --import tsx scripts/research-crawl.ts"
    "research:auto-trade": "node --import tsx scripts/research-auto-trade.ts"
    "plan:generate": "node --import tsx scripts/generate-plan.ts"
    "health:alpaca": "node --import tsx scripts/alpaca-health.ts"
  deps:
    next: "^16.2.10"
    react: "^19.2.7"
    react_dom: "^19.2.7"
    openai: "^6.45.0"
    alpacahq_alpaca_trade_api: "^3.1.3"
    prisma_client: "^5.22.0"
    technicalindicators: "^3.1.0"
    zod: "^4.4.3"
    lucide_react: "^1.23.0"
  dev_deps:
    typescript: "^6.0.3"
    prisma: "^5.22.0"
    railway: "^3.4.1"
    tsx: "^4.23.0"
    vitest: "^4.1.9"
    eslint: "^9.39.4"
    eslint_config_next: "^16.2.10"
  overrides:
    axios: "1.18.1"
    postcss: "8.5.16"

env_contract:
  source: lib/config/env.ts
  schema:
    OPENAI_API_KEY:
      type: string
      default: ""
      purpose: OpenAI Responses API authentication.
    OPENAI_MODEL:
      type: string
      default: "gpt-5.5"
      purpose: Model passed to OpenAI Responses API.
    OPENAI_REASONING_EFFORT:
      type: enum
      values: [low, medium, high, xhigh]
      default: medium
    OPENAI_TEXT_VERBOSITY:
      type: enum
      values: [low, medium, high]
      default: low
    OPENAI_STORE_RESPONSES:
      type: boolean_string
      default: false
    OPENAI_REVIEW_HOLD_SIGNALS:
      type: boolean_string
      default: false
      behavior: When false, runBotScan skips OpenAI calls for deterministic RSI hold signals and records a local hold audit.
    APCA_API_KEY_ID:
      type: string
      default: ""
      purpose: Alpaca paper API key id.
    APCA_API_SECRET_KEY:
      type: string
      default: ""
      purpose: Alpaca paper API secret.
    APCA_API_BASE_URL:
      type: url
      default: "https://paper-api.alpaca.markets"
      invariant: Use paper endpoint in current scaffold.
    ALPACA_DATA_BASE_URL:
      type: url
      default: "https://data.alpaca.markets"
    TRADING_MODE:
      type: enum
      values: [paper, live]
      default: paper
      invariant: Risk gate blocks live mode in this scaffold.
    LIVE_TRADING_ENABLED:
      type: boolean_string
      default: false
      invariant: true blocks order submission in current risk gate.
    WATCHLIST:
      type: csv_symbols
      default: "AAPL,MSFT,SPY,QQQ"
    RSI_PERIOD:
      type: number_string
      default: 14
      runtime_min: 2
    RSI_TIMEFRAME:
      type: string
      default: "5Min"
    RSI_OVERSOLD:
      type: number_string
      default: 30
    RSI_OVERBOUGHT:
      type: number_string
      default: 70
    MIN_AI_CONFIDENCE:
      type: number_string
      default: 0.55
      runtime_clamp: [0, 1]
    MAX_NOTIONAL_PER_ORDER:
      type: number_string
      default: 10
      runtime_min: 1
    MAX_POSITION_NOTIONAL_PER_SYMBOL:
      type: number_string
      default: 25
      runtime_min: 1
    MAX_DAILY_LOSS_USD:
      type: number_string
      default: 5
      runtime_min: 0
    MAX_OPEN_POSITIONS:
      type: number_string
      default: 3
      runtime_min: 1
    BOT_POLL_INTERVAL_SECONDS:
      type: number_string
      default: 300
      runtime_min: 60
    RESEARCH_SYMBOLS:
      type: csv_symbols
      default: ""
      behavior: Empty uses WATCHLIST as fallback research symbols.
    RESEARCH_MAX_SYMBOLS:
      type: number_string
      default: 8
      runtime_min: 1
      behavior: Caps the resolved RESEARCH_SYMBOLS/WATCHLIST/focused-symbol research universe.
    RESEARCH_LOOKBACK_HOURS:
      type: number_string
      default: 6
      runtime_min: 1
    RESEARCH_NEWS_LIMIT:
      type: number_string
      default: 20
      runtime_clamp: [1, 50]
    RESEARCH_OPPORTUNITY_TTL_HOURS:
      type: number_string
      default: 24
      runtime_min: 1
    RESEARCH_MIN_CONFIDENCE:
      type: number_string
      default: 0.35
      runtime_clamp: [0, 1]
    RESEARCH_AUTO_TRADE_ENABLED:
      type: boolean_string
      default: false
      purpose: Enables explicit research-driven paper auto-trading in the worker and script.
      invariant: Orders are blocked unless TRADING_MODE=paper and LIVE_TRADING_ENABLED=false.
    RESEARCH_AUTO_TRADE_MIN_CONFIDENCE:
      type: number_string
      default: 0.55
      runtime_clamp: [0, 1]
    RESEARCH_AUTO_TRADE_MIN_SCORE:
      type: number_string
      default: 0.45
      runtime_clamp: [0, 1]
    RESEARCH_AUTO_TRADE_NOTIONAL:
      type: number_string
      default: 1
      runtime_min: 1
    RESEARCH_AUTO_TRADE_MAX_ITEMS_PER_RUN:
      type: number_string
      default: 1
      runtime_min: 1
    RESEARCH_AUTO_TRADE_MAX_OPEN_POSITIONS:
      type: number_string
      default: 10
      runtime_min: 1
    RESEARCH_AUTO_TRADE_MAX_DAILY_ORDERS:
      type: number_string
      default: 20
      runtime_min: 1
    RESEARCH_AUTO_TRADE_SYMBOL_COOLDOWN_MINUTES:
      type: number_string
      default: 240
      runtime_min: 0
    DATABASE_URL:
      type: string
      purpose: Prisma PostgreSQL URL, normally Railway Postgres in hosted environments.
  helpers:
    getEnv: zod parse of process.env.
    isOpenAiConfigured: OPENAI_API_KEY non-empty.
    isAlpacaConfigured: APCA_API_KEY_ID and APCA_API_SECRET_KEY non-empty.
    getBotRuntimeConfig: converts env into BotRuntimeConfig.
    getResearchRuntimeConfig: converts env into research crawler config.
    getResearchAutoTradeRuntimeConfig: converts env into explicit research paper auto-trade limits.
    getPublicRuntimeSummary: safe dashboard summary without secrets.

data_model:
  source: prisma/schema.prisma
  datasource: postgresql
  models:
    BotConfig:
      key: String id
      value: String
      updatedAt: DateTime updatedAt
      use: Stores runtime settings including bot.enabled, trade.sizing, and research.focusSymbols.
    MarketSnapshot:
      fields: [id, symbol, timeframe, price, rsi, barsJson, createdAt]
      indexes: [[symbol, createdAt]]
      use: Persist scan market data and raw bars JSON.
    PortfolioSnapshot:
      fields: [id, portfolioValue, cash, buyingPower, longMarketValue, unrealizedPnl, openPositionsCount, createdAt]
      indexes: [[createdAt]]
      use: Stores paper account value snapshots for live portfolio value/P&L charting.
    Signal:
      fields: [id, symbol, action, confidence, rsi, reason, recommendedNotional, createdAt]
      indexes: [[symbol, createdAt]]
      use: Persist deterministic RSI signal before AI/risk gate.
    AiAudit:
      fields: [id, symbol, promptHash, inputJson, outputJson, decision, confidence, rationale, riskFlagsJson, learningUpdateJson, recommendedAdjustmentsJson, accepted, rejectionReasonsJson, tradeOutcomeJson, openAiResponseId, createdAt]
      indexes: [[symbol, createdAt], [createdAt]]
      use: Full audit of AI decision, risk gate, and optional order result.
    Trade:
      fields: [id, symbol, side, strategy, qty, notional, price, orderId, status, realizedPnl, rationale, tradeOutcomeJson, filledAt, reconciledAt, createdAt, closedAt]
      indexes: [[symbol, createdAt], [strategy, createdAt], [orderId], [status, createdAt]]
      use: Records submitted paper orders, execution strategy/source, reconciled fills, and realized outcomes.
    LearningEvent:
      fields: [id, symbol, reward, summary, source, createdAt]
      indexes: [[symbol, createdAt]]
      use: Stores AI and reconciliation learning summaries used as priorLessons in future scans.
    ResearchItem:
      fields: [id, externalId, symbol, source, sourceUrl, headline, summary, contentHash, allSymbolsJson, sentiment, catalyst, riskFlagsJson, confidence, publishedAt, discoveredAt, expiresAt]
      unique: [externalId]
      indexes: [[symbol, publishedAt], [expiresAt]]
      use: Stores source-backed news records used to create opportunities.
    Opportunity:
      fields: [id, symbol, direction, thesis, catalyst, confidence, score, sourceItemIdsJson, riskFlagsJson, status, firstSeenAt, lastSeenAt, expiresAt, createdAt]
      indexes: [[symbol, status, expiresAt], [score], [expiresAt]]
      use: Stores active or expired research-derived market opportunities.
    TradePlan:
      fields: [id, status, inputSummaryJson, generatedAt, createdAt]
      indexes: [[status, generatedAt], [generatedAt]]
      use: Stores a generated advisory trade plan. New generated plans supersede previous active plans.
    TradePlanItem:
      fields: [id, planId, rank, symbol, suggestedAction, thesis, catalyst, confidence, score, riskNotesJson, eligibleForRsi, tradableNow, tradabilityReason, opportunityIdsJson, sourceUrlsJson, learningNotesJson, positionJson, createdAt]
      indexes: [[planId, rank], [symbol, createdAt]]
      relation: TradePlanItem.planId -> TradePlan.id cascade delete
      use: Stores ranked beginner-readable plan candidates. Items are advisory and cannot place trades.

type_contract:
  source: lib/types/trading.ts
  core_types:
    TradingMode: ["paper", "live"]
    TradeAction: ["buy", "sell", "hold", "block"]
    OrderSide: ["buy", "sell"]
    TradeStrategy: ["rsi_ai", "research_auto", "manual"]
    MarketBar: { timestamp, open, high, low, close, volume }
    AccountSnapshot: { id?, status?, currency?, buyingPower, cash, portfolioValue }
    PositionSnapshot: { symbol, qty, marketValue, avgEntryPrice, unrealizedPnl }
    PortfolioSnapshotPoint: { id?, portfolioValue, cash, buyingPower, longMarketValue, unrealizedPnl, openPositionsCount, createdAt }
    PortfolioHistoryResult: { generatedAt, rangeHours, points, latest?, baselineValue?, change?, changePercent?, error? }
    PortfolioPositionValue: { symbol, qty, marketValue, avgEntryPrice, unrealizedPnl, allocationPercent }
    PortfolioPositionsResult: { generatedAt, positions, totalMarketValue, error? }
    StockAsset: { symbol, name, exchange?, assetClass?, status?, tradable, fractionable }
    TradeSizingSettings: { minBidNotional, maxBidNotional, updatedAt? }
    OrderRequest: { symbol, side, notional?, qty?, type?, timeInForce?, clientOrderId? }
    OrderResult: { id, symbol, side, status, notional?, qty?, filledAvgPrice? }
    BrokerOrderSnapshot: OrderResult plus { filledAt?, submittedAt? }
    TradeFillActivity: { id, orderId?, symbol, side, qty, price, transactionTime }
    RsiSignal: { symbol, action: buy_or_sell_or_hold, rsi?, previousRsi?, confidence, reason, recommendedNotional? }
    RiskLimits: { maxNotionalPerOrder, maxPositionNotionalPerSymbol, maxDailyLossUsd, maxOpenPositions, minAiConfidence }
    BotRuntimeConfig: { watchlist, rsiPeriod, timeframe, oversoldThreshold, overboughtThreshold, openAiReviewHoldSignals, tradingMode, liveTradingEnabled, paperTradingEndpoint, pollIntervalSeconds, risk }
    ResearchAutoTradeConfig: { enabled, minConfidence, minScore, notionalPerOrder, minNotionalPerOrder, maxNotionalPerOrder, maxItemsPerRun, maxOpenPositions, maxDailyOrders, symbolCooldownMinutes }
    ResearchBrief: { symbol, direction, thesis, catalyst, confidence, score, riskFlags, expiresAt }
    TradingContext: { symbol, generatedAt, currentPrice, barSummary, rsi, deterministicSignal, position?, account, openPositionsCount, recentTrades, realizedPnlToday, riskLimits, priorLessons, researchBriefs }
    AiTradingDecision: { decision, confidence, rationale, riskFlags, learningUpdate, recommendedParameterAdjustments }
    AiDecisionResult: AiTradingDecision plus { configured, promptHash, inputJson, outputJson, openAiResponseId? }
    RiskGateResult: { accepted, finalAction, reasons, order? }
    ScanSymbolResult: { symbol, signal, aiDecision, riskGate, order? }
    ScanResult: { startedAt, finishedAt, dryRun, tradingMode, symbols }
    NewsArticle: { id, source, url, headline, summary?, content?, symbols, createdAt, updatedAt? }
    ResearchAnalysis: { sentiment, catalyst, thesis, confidence, score, riskFlags, expiresAt }
    ResearchCrawlResult: { startedAt, finishedAt, source, scannedArticles, storedItems, updatedItems, opportunitiesCreated, opportunitiesUpdated, symbols }
    ReconcileResult: { startedAt, finishedAt, checkedTrades, updatedOrders, closedTrades, learningEvents }
    ResearchAutoTradeItemResult: { symbol, action: buy_or_sell_or_skip, accepted, reasons, confidence, score, thesis, catalyst, opportunityIds, sourceUrls, orderRequest?, order? }
    ResearchAutoTradeResult: { startedAt, finishedAt, enabled, dryRun, tradingMode, submittedOrders, candidatesEvaluated, config, items }
    TradePlanSuggestedAction: ["watch", "buy_candidate", "sell_candidate", "avoid"]
    TradePlanItemSummary: { rank, symbol, suggestedAction, thesis, catalyst, confidence, score, riskNotes, eligibleForRsi, tradableNow, tradabilityReason, opportunityIds, sourceUrls, learningNotes, position? }
    TradePlanResult: { id, status, generatedAt, createdAt, inputSummary including focusedSymbolCount, items }

strategy_contract:
  source: lib/strategy/rsi.ts
  library: technicalindicators.RSI
  functions:
    calculateRsi:
      input: close values and period
      behavior: returns [] when values.length <= period, else RSI.calculate.
    summarizeBars:
      input: MarketBar[]
      behavior_empty: { count: 0 }
      behavior_non_empty: count, firstClose, lastClose, high max, low min, summed volume.
    createRsiSignal:
      input: symbol, bars, period, oversoldThreshold, overboughtThreshold, maxNotionalPerOrder
      behavior_no_rsi:
        action: hold
        confidence: 0
        recommendedNotional: 0
        reason: Need more bars.
      behavior_buy:
        condition: current RSI <= oversold OR previous RSI < oversold and current RSI >= oversold
        confidence: min(0.9, 0.58 + oversold_distance/100 + recovery_bonus)
        recommendedNotional: maxNotionalPerOrder
      behavior_sell:
        condition: current RSI >= overbought
        confidence: min(0.92, 0.6 + overbought_distance/100)
        recommendedNotional: maxNotionalPerOrder
      behavior_hold:
        condition: RSI between thresholds
        confidence: 0.5
        recommendedNotional: 0

ai_contract:
  sources: [lib/ai/reasoning.ts, lib/ai/schema.ts]
  service: AIReasoningService
  api: OpenAI Responses API client.responses.create
  request_shape:
    model: env.OPENAI_MODEL
    store: env.OPENAI_STORE_RESPONSES
    reasoning.effort: env.OPENAI_REASONING_EFFORT
    text.verbosity: env.OPENAI_TEXT_VERBOSITY
    text.format.type: json_schema
    text.format.name: trading_ai_decision
    text.format.strict: true
    input:
      system: "reasoning layer for a paper-trading RSI bot; may reduce confidence, hold, or block; must not override deterministic RSI or risk limits"
      user: compact TradingContext JSON
  compact_context_fields:
    [symbol, generatedAt, currentPrice, barSummary, rsi, deterministicSignal, position_or_null, account.buyingPower, account.cash, account.portfolioValue, openPositionsCount, recentTrades_first_8, realizedPnlToday, riskLimits, priorLessons_first_8, researchBriefs_first_5]
  response_schema_required:
    decision: enum buy/sell/hold/block
    confidence: number 0..1
    rationale: string
    riskFlags: string[]
    learningUpdate:
      summary: string
      rewardSignal: number -1..1
      observations: string[]
      mistakesToAvoid: string[]
    recommendedParameterAdjustments:
      rsiPeriod: number
      oversoldThreshold: number
      overboughtThreshold: number
      maxNotionalMultiplier: number 0..1
  fallback:
    condition: OpenAI missing, response missing, JSON parse failure, schema failure, API error.
    decision: block
    confidence: 0
    configured: false
    riskFlags: ["ai_unavailable"]
    maxNotionalMultiplier: 0
  deterministic_hold_skip:
    condition: deterministic RSI signal is hold and OPENAI_REVIEW_HOLD_SIGNALS is false.
    behavior: OpenAI is not called; a local hold AiDecisionResult is recorded with riskFlags ["openai_skipped_for_deterministic_hold"] and empty learning summary.
  invariant: AI does not submit orders and cannot force a trade. Risk gate requires AI decision to exactly match deterministic buy/sell.

broker_contract:
  interface_source: lib/broker/types.ts
  adapter_interface:
    getAccount: Promise<AccountSnapshot>
    getPositions: Promise<PositionSnapshot[]>
    getBars: Promise<Record<symbol, MarketBar[]>>
    submitOrder: Promise<OrderResult>
    getOrder: Promise<BrokerOrderSnapshot>
    getFillActivities: Promise<TradeFillActivity[]>
    cancelAllOrders: Promise<void>
    healthCheck: Promise<{ok,message}>
  alpaca_source: lib/broker/alpaca.ts
  alpaca_behavior:
    sdk: "@alpacahq/alpaca-trade-api"
    credentials: APCA_API_KEY_ID, APCA_API_SECRET_KEY
    baseUrl: APCA_API_BASE_URL
    paper_flag: APCA_API_BASE_URL includes "paper"
    healthCheck: client.getAccount, returns account id/status message.
    getAccount: maps buying_power/cash/portfolio_value to numbers.
    getPositions: maps Alpaca position fields to PositionSnapshot.
    getBars:
      endpoint: ALPACA_DATA_BASE_URL + "/v2/stocks/bars"
      query: symbols csv, timeframe, limit, adjustment=raw, feed=iex
      auth_headers: APCA-API-KEY-ID, APCA-API-SECRET-KEY
      cache: no-store
      maps: t/o/h/l/c/v to MarketBar
    submitOrder:
      creates Alpaca order with symbol, side, type default market, time_in_force default day, qty, notional, client_order_id.
      returns id, symbol, side, status, qty, notional, filledAvgPrice.
    getOrder:
      endpoint: APCA_API_BASE_URL + "/v2/orders/{orderId}"
      behavior: returns order status, filled quantity, filled average price, submittedAt, filledAt.
    getFillActivities:
      endpoint: APCA_API_BASE_URL + "/v2/account/activities/FILL"
      query: after, until, direction=asc, page_size=100.
      behavior: maps fill activities to TradeFillActivity; currently available for reconciliation extension use.
    cancelAllOrders: client.cancelAllOrders.
  mock_source: lib/broker/mock.ts
  mock_behavior:
    in_memory_account: ACTIVE USD 1000
    positions: mutable array
    bars: mutable symbol map
    submitOrder: appends accepted mock order with optional last close as filledAvgPrice.
    getOrder: returns matching mock order as filled.
    getFillActivities: maps mock orders into synthetic fills.

asset_search_contract:
  source: lib/market/assets.ts
  provider: Alpaca Trading API
  endpoint: APCA_API_BASE_URL + "/v2/assets?status=active&asset_class=us_equity"
  behavior:
    - Requires Alpaca paper credentials.
    - Caches active US equity assets in-process for 10 minutes.
    - Searches by ticker symbol or company name.
    - Returns StockAsset rows with tradable and fractionable flags.
  consumers:
    - GET /api/stocks/search
    - manual_order_contract asset validation

reconciliation_contract:
  source: lib/bot/reconcile.ts
  function: reconcileTrades
  options:
    broker: injectable BrokerAdapter, default new AlpacaBroker()
    since: default now minus 10 days
    createLearningEvents: default true
  flow:
    1: Load recent trades with orderId that are unreconciled, non-terminal, missing fill data, or filled sells without realizedPnl.
    2: Fetch Alpaca order snapshots by orderId.
    3: Update Trade status, qty, price, filledAt, reconciledAt, and tradeOutcomeJson.
    4: For filled sell trades without realizedPnl, match against earliest open filled buys for the same symbol.
    5: Store realizedPnl and closedAt on the sell and matched buy trades.
    6: Create LearningEvent(source=alpaca_reconciliation) when a sell closes at least one buy.
  reward:
    formula: clamp(realizedPnl / sellNotional, -1, 1)
  limitation:
    matching_model: FIFO-style first pass; partial buy lots are not yet tracked with remaining quantity.

portfolio_snapshot_contract:
  source: lib/portfolio/snapshots.ts
  functions:
    recordPortfolioSnapshot:
      input: optional broker, minIntervalSeconds default 10, now
      behavior:
        - Reuses the latest PortfolioSnapshot without broker calls when it is newer than minIntervalSeconds.
        - Otherwise reads AlpacaBroker.getAccount and getPositions.
        - Persists portfolioValue, cash, buyingPower, longMarketValue, unrealizedPnl, openPositionsCount, createdAt.
    getPortfolioHistory:
      input: rangeHours default 24 clamped 1..168, refresh default true, minIntervalSeconds.
      behavior:
        - Optionally records a fresh snapshot before reading history.
        - Returns snapshots in ascending time order for the requested range.
        - Calculates baselineValue from the first point, latest point, change, and changePercent.
        - Returns an error string with available history if refresh fails.
    summarizePortfolioPositions:
      behavior: sums long market value, unrealized P/L, and open long position count from broker positions.
  consumers:
    - GET /api/portfolio/history for dashboard polling.
    - scripts/worker.ts records a snapshot once per enabled loop with minIntervalSeconds=45.

portfolio_positions_contract:
  source: lib/portfolio/positions.ts
  function: getPortfolioPositions
  behavior:
    - Reads AlpacaBroker.getPositions.
    - Filters open long paper positions.
    - Calculates total long market value and per-position allocationPercent.
    - Returns positions sorted by marketValue descending.
  consumers:
    - GET /api/portfolio/positions for the Trades dashboard holdings chart.

research_contract:
  sources: [lib/research/alpacaNews.ts, lib/research/scoring.ts, lib/research/crawl.ts]
  news_provider: Alpaca Market Data News API
  endpoint: ALPACA_DATA_BASE_URL + "/v1beta1/news"
  crawl_function: runResearchCrawl
  script: npm run research:crawl
  query:
    symbols: normalized RESEARCH_SYMBOLS or WATCHLIST fallback, plus BotConfig research.focusSymbols when run without explicit --symbols, capped by RESEARCH_MAX_SYMBOLS
    start: now minus RESEARCH_LOOKBACK_HOURS
    limit: RESEARCH_NEWS_LIMIT clamped 1..50
    include_content: false
    exclude_contentless: false
    empty_symbol_behavior: skips the Alpaca News request and returns zero scanned articles rather than making an unfiltered news query.
  storage:
    - Upsert ResearchItem by externalId "{article.id}:{symbol}".
    - Store source URL, headline, source, published timestamp, symbols JSON, content hash, sentiment, catalyst, risk flags, confidence, expiry.
    - Expire old Opportunity rows before each crawl.
    - Create/update active Opportunity rows by symbol and direction when confidence >= RESEARCH_MIN_CONFIDENCE.
    - Focused symbols are stored in BotConfig key research.focusSymbols and can be updated from the Stocks dashboard.
  scoring:
    type: deterministic keyword classifier.
    directions: bullish, bearish, watch.
    positive_terms_examples: [approval, beat, buyback, contract, guidance raised, launch, partnership, upgrade]
    risk_terms_examples: [bankruptcy, downgrade, investigation, lawsuit, miss, probe, recall, warning]
  invariant:
    Research opportunities are source-backed inputs for AI context, trade plans, and the explicit research auto-trade executor. They cannot bypass paper-only safety, size limits, cooldowns, or live-trading blocks.

trade_plan_contract:
  source: lib/plan/builder.ts
  function: buildTradePlan
  script: npm run plan:generate
  inputs:
    - Active Opportunity rows where status=active and expiresAt > now.
    - Focused symbols from BotConfig research.focusSymbols.
    - Current paper positions from AlpacaBroker.getPositions when Alpaca credentials are configured; falls back to no positions if unavailable.
    - Recent LearningEvent rows for candidate symbols.
    - BotRuntimeConfig watchlist and risk limits.
  ranking:
    - Candidate symbols come from active opportunities, focused symbols, and current long positions.
    - Net research score sums opportunity scores per symbol and clamps to [-1, 1].
    - Suggested action is buy_candidate for positive research without an existing position, sell_candidate for negative research with an existing long position, avoid for negative research without a long position, and watch otherwise.
    - Focused symbols without an active source-backed catalyst are included as watch items.
    - Confidence blends strongest opportunity confidence, absolute net research score, source count, and recent learning rewards.
    - Items are sorted by plan score, action priority, then symbol.
  fields:
    item:
      - candidate symbol
      - beginner-readable thesis
      - catalyst/news reason plus stored source URLs
      - confidence and score
      - suggested action: watch/buy_candidate/sell_candidate/avoid
      - risk notes from opportunity risk flags, watchlist eligibility, current position, and learning signals
      - focused symbol note when the item came from research.focusSymbols
      - eligibleForRsi: symbol is in WATCHLIST
      - tradableNow/tradabilityReason: high-level paper eligibility explanation only; false when live mode, live enable flag, or non-paper Alpaca endpoint safety is not satisfied
  persistence:
    - buildTradePlan supersedes prior active TradePlan rows and creates one active TradePlan with TradePlanItem children.
    - getLatestTradePlan reads the newest generated plan with items ordered by rank.
  invariant:
    Trade plans are advisory only. Plan items do not submit orders, do not invoke risk gate acceptance, and are not called from runBotScan.

research_auto_trade_contract:
  source: lib/bot/researchAutoTrade.ts
  function: runResearchAutoTrade
  script: npm run research:auto-trade
  default_state:
    enabled: false unless RESEARCH_AUTO_TRADE_ENABLED is true
    worker_cadence: controlled by BOT_POLL_INTERVAL_SECONDS, default 300 seconds
  inputs:
    - Active Opportunity rows where status=active and expiresAt > now.
    - Current paper account and positions from AlpacaBroker.
    - Recent Trade rows with strategy=research_auto for cooldown checks.
    - Current-day research_auto trade count for daily cap checks.
    - Current-day realized P/L for daily loss guard.
    - Trade sizing settings from BotConfig trade.sizing unless explicit config is injected.
  candidate_rules:
    - Bullish opportunities with confidence >= RESEARCH_AUTO_TRADE_MIN_CONFIDENCE and score >= RESEARCH_AUTO_TRADE_MIN_SCORE become buy candidates, even when the symbol is outside WATCHLIST.
    - Bearish opportunities meeting the same absolute thresholds can create sell candidates only for existing long paper positions.
    - If a held symbol has both bullish and bearish opportunities, the strongest absolute score wins; bearish exits take priority when tied or stronger.
    - Candidates are sorted by sell priority, absolute score, confidence, then symbol.
  paper_safety_gates:
    - config.tradingMode must be paper, config.liveTradingEnabled must be false, and APCA_API_BASE_URL must resolve as a paper endpoint.
    - Current-day realized P/L must not breach MAX_DAILY_LOSS_USD.
    - Current-day strategy=research_auto trade count must be below RESEARCH_AUTO_TRADE_MAX_DAILY_ORDERS.
    - Each worker/script run submits at most RESEARCH_AUTO_TRADE_MAX_ITEMS_PER_RUN accepted orders.
    - New buy positions are capped by RESEARCH_AUTO_TRADE_MAX_OPEN_POSITIONS.
    - Per-symbol exposure is capped by MAX_POSITION_NOTIONAL_PER_SYMBOL.
    - Buy target notional is scaled between trade.sizing minBidNotional and maxBidNotional by opportunity strength.
    - Final buy notional is min(scaled target, MAX_NOTIONAL_PER_ORDER after runtime sizing, remaining symbol capacity, buying power).
    - Buys are blocked when final notional is below trade.sizing minBidNotional.
    - Same-symbol same-side research_auto trades respect RESEARCH_AUTO_TRADE_SYMBOL_COOLDOWN_MINUTES.
  orders:
    buy:
      type: market
      timeInForce: day
      notional: bounded notional above
      clientOrderId: "bb-ra-{symbol-lower}-{Date.now()}"
    sell:
      type: market
      timeInForce: day
      qty: current long paper position quantity
      clientOrderId: "bb-ra-{symbol-lower}-{Date.now()}"
  persistence:
    - Submitted orders create Trade rows with strategy=research_auto.
    - tradeOutcomeJson stores source=research_auto_trade, opportunity ids, source URLs, confidence, score, and order request.
    - Submitted orders create LearningEvent(source=research_auto_trade, reward=0) so future scans/plans can see that a research-driven paper action happened.
    - Reconciliation later updates fills and creates outcome learning when sells close buys.
  dry_run:
    - `npm run research:auto-trade -- --dry-run` evaluates candidates and order requests without broker submission or persistence.
  invariant:
    Research auto-trading is separate from runBotScan and does not modify RSI, OpenAI review, or the RSI risk gate. It is paper-only and auditable by Trade.strategy.

manual_order_contract:
  source: lib/trading/manualOrder.ts
  api: POST /api/orders/manual-buy
  behavior:
    - User submits symbol and notional from the Stocks dashboard search UI.
    - Looks up active US equity assets through Alpaca /v2/assets and requires a tradable fractionable asset.
    - Requires TRADING_MODE=paper, LIVE_TRADING_ENABLED=false, and APCA_API_BASE_URL to be a paper endpoint.
    - Requires notional between $1 and $100,000 and notional <= current paper buying power.
    - Submits an Alpaca paper market buy with timeInForce=day.
    - Creates Trade(strategy=manual) and LearningEvent(source=manual_order) when persisted.
  invariant:
    Manual orders are explicit user-directed paper orders. They are not bot-generated recommendations and do not change RSI, OpenAI review, research auto-trading, or risk gate behavior.

risk_gate_contract:
  source: lib/bot/risk.ts
  function: evaluateRiskGate
  inputs: signal, aiDecision, context, config, dryRun
  hard_blocks:
    - config.tradingMode != paper OR config.liveTradingEnabled true => reason live trading disabled.
    - APCA_API_BASE_URL not recognized as paper endpoint via BotRuntimeConfig.paperTradingEndpoint.
    - symbol not in watchlist.
    - aiDecision.configured false.
    - realizedPnlToday <= negative maxDailyLossUsd.
    - max open positions reached for new buy with no existing position.
    - aiDecision.decision == block.
    - aiDecision.confidence < minAiConfidence when deterministic signal is not hold.
  deterministic_hold:
    if signal.action == hold => accepted false, finalAction hold, append "Deterministic RSI signal is hold."
  ai_alignment:
    accepted only if aiDecision.decision exactly equals deterministic signal.action for buy/sell.
    mismatch => accepted false finalAction hold.
  sell_guard:
    sell ignored if no long position.
  buy_sizing:
    notional = max(0, min(maxNotionalPerOrder, recommendedNotional, maxPositionNotionalPerSymbol - currentExposure))
    no capacity blocks buy.
  accepted_buy_order:
    side: buy
    notional: calculated
    type: market
    timeInForce: day
    clientOrderId: "branddbot-{symbol-lower}-{Date.now()}"
  accepted_sell_order:
    side: sell
    qty: current position qty
    type: market
    timeInForce: day
    clientOrderId: "branddbot-{symbol-lower}-{Date.now()}"
  dryRun_note: dryRun is passed to risk gate but actual order suppression happens in runBotScan.

scan_contract:
  source: lib/bot/scan.ts
  function: runBotScan
  options:
    dryRun: default true
    broker: injectable BrokerAdapter, default new AlpacaBroker()
    aiService: injectable AIReasoningService, default new AIReasoningService()
    persistence: injectable ScanPersistence, default createPrismaScanPersistence()
    config: injectable BotRuntimeConfig, default getBotRuntimeConfig()
  flow:
    1: startedAt = new Date()
    2: load config and dependencies.
    3: parallel fetch account, positions, realizedPnlToday, barsBySymbol.
    4: bars limit = max(rsiPeriod + 40, 60)
    5: for each watchlist symbol:
      - bars = barsBySymbol[symbol] or []
      - currentPrice = last bar close or 0
      - create deterministic RSI signal
      - find current position
      - fetch recentTrades, priorLessons, and active researchBriefs
      - record MarketSnapshot
      - record Signal
      - build TradingContext
      - aiDecision = AIReasoningService.skipForDeterministicHold(context) when signal.action=hold and OPENAI_REVIEW_HOLD_SIGNALS=false; otherwise AIReasoningService.reason(context)
      - riskGate = evaluateRiskGate(...)
      - if riskGate.accepted and riskGate.order and not dryRun: broker.submitOrder
      - if order: recordTrade
      - recordAiAudit always
      - push ScanSymbolResult
    6: return ScanResult with timestamps, dryRun, tradingMode, symbols.

persistence_contract:
  source: lib/bot/persistence.ts
  interface: ScanPersistence
  methods:
    getRecentTrades:
      query: Trade rows by symbol desc take 8
      output: symbol, side, notional, qty, price, realizedPnl, status, createdAt iso, closedAt iso
    getPriorLessons:
      query: LearningEvent by symbol desc take 8
      output: summary strings
    getResearchBriefs:
      query: active Opportunity rows by symbol where expiresAt > now order by score desc take 5
      output: ResearchBrief[]
    getRealizedPnlToday:
      query: Trade rows since current UTC midnight where realizedPnl not null
      output: sum realizedPnl
    recordMarketSnapshot: creates MarketSnapshot with barsJson.
    recordSignal: creates Signal.
    recordAiAudit:
      creates AiAudit with AI and risk payloads.
      also creates LearningEvent source=openai when learningUpdate.summary is non-empty.
    recordTrade: creates Trade from OrderResult, rationale, and optional strategy; RSI scan trades default to strategy=rsi_ai.
  noop: createNoopScanPersistence for tests.

api_contract:
  next_app_router:
    GET /api/health/alpaca:
      source: app/api/health/alpaca/route.ts
      behavior: AlpacaBroker.healthCheck; status 200 if ok else 400.
    GET /api/account:
      source: app/api/account/route.ts
      behavior: healthCheck then account and positions; status 400 if health fails.
    GET /api/portfolio/history:
      source: app/api/portfolio/history/route.ts
      query: { rangeHours?: number }
      behavior: refreshes a throttled Alpaca paper portfolio snapshot, then returns PortfolioHistoryResult for the requested range; status 500 on unrecoverable error.
    GET /api/portfolio/positions:
      source: app/api/portfolio/positions/route.ts
      behavior: returns current open long paper positions, total long market value, allocation percentages, and generatedAt; status 500 with empty positions on error.
    GET /api/settings/trade-sizing:
      source: app/api/settings/trade-sizing/route.ts
      behavior: returns BotConfig-backed TradeSizingSettings with env-derived defaults when unset or BotConfig is temporarily unavailable.
    POST /api/settings/trade-sizing:
      source: app/api/settings/trade-sizing/route.ts
      body: { minBidNotional, maxBidNotional }
      behavior: validates $1 <= min <= max <= $100,000, stores BotConfig trade.sizing, and returns settings.
    GET /api/focus-symbols:
      source: app/api/focus-symbols/route.ts
      behavior: returns focused symbols from BotConfig research.focusSymbols, or [] when BotConfig is temporarily unavailable.
    POST /api/focus-symbols:
      source: app/api/focus-symbols/route.ts
      body: { symbol, focused } or { symbols }
      behavior: validates/normalizes symbols, updates BotConfig research.focusSymbols, and returns the full focused symbol list.
    GET /api/stocks/search:
      source: app/api/stocks/search/route.ts
      query: { q, limit? }
      behavior: searches Alpaca active US equity assets by ticker or company name and returns StockAsset rows.
    POST /api/orders/manual-buy:
      source: app/api/orders/manual-buy/route.ts
      body: { symbol, notional }
      behavior: submits an explicit user-directed Alpaca paper market buy through manual_order_contract and records Trade(strategy=manual); status 400 on validation/safety failure.
    POST /api/bot/scan:
      source: app/api/bot/scan/route.ts
      body: { dryRun?: boolean }
      default: dryRun true
      behavior: runBotScan; response message contains Dry/Paper and accepted decision count; status 500 on error.
    GET /api/bot/status:
      source: app/api/bot/status/route.ts
      behavior: returns enabled, runtime public summary including paperTradingEndpoint and researchAutoTrade, and latestAudit.
    POST /api/bot/toggle:
      source: app/api/bot/toggle/route.ts
      body: { enabled?: boolean }
      behavior: stores boolean enabled in BotConfig; does not start worker by itself.
    POST /api/bot/emergency-stop:
      source: app/api/bot/emergency-stop/route.ts
      behavior: set enabled false; if Alpaca healthy cancel all orders.
    POST /api/orders/cancel-all:
      source: app/api/orders/cancel-all/route.ts
      behavior: healthCheck then cancel all Alpaca paper orders; status 400 if health fails.
    GET /api/plan:
      source: app/api/plan/route.ts
      behavior: returns latest generated TradePlan with ranked TradePlanItem summaries, or null if none exists.
    POST /api/plan:
      source: app/api/plan/route.ts
      body: { maxItems?: number }
      behavior: buildTradePlan and return persisted advisory plan; status 500 on error. Does not place trades.

ui_contract:
  dashboard:
    layout:
      source: app/dashboard/layout.tsx
      nav_source: app/dashboard/DashboardNav.tsx
      top_nav_routes: [/dashboard, /dashboard/plan, /dashboard/trades, /dashboard/stocks, /dashboard/research]
    overview:
      source: app/dashboard/page.tsx
      route: /dashboard
      dynamic: force-dynamic
      reads:
        - getBotEnabled
        - latest AiAudit
        - active Opportunity count
        - open Trade count
        - getTradeSizingSettings
        - getFocusedSymbols
        - getPublicRuntimeSummary
      displays:
        - badges for PAPER/LIVE, OpenAI configured/missing, Alpaca configured/missing, Enabled/Paused
        - model, watchlist, bid range, research auto-trade status
        - controls
        - latest AI decision
        - bot state for open paper trades, base/focused research symbols with research cap, research auto-trading, active opportunities, and max position size
    plan:
      source: app/dashboard/plan/page.tsx
      route: /dashboard/plan
      dynamic: force-dynamic
      controls_source: app/dashboard/plan/PlanControls.tsx
      controls:
        Generate Plan: POST /api/plan
      displays:
        - Latest TradePlan generated timestamp and advisory-only badges.
        - Plan item metrics for total items, RSI eligible items, and tradable candidates.
        - Input badges including opportunity count, current positions, learning notes, focused symbols, and advisory-only mode.
        - Ranked table with candidate symbol, suggested action, confidence, thesis, catalyst/news reason, source links, risk notes, RSI eligibility, tradableNow, and tradability reason.
    trades:
      source: app/dashboard/trades/page.tsx
      route: /dashboard/trades
      dynamic: force-dynamic
      chart_source: app/dashboard/trades/PortfolioValueChart.tsx
      sizing_controls_source: app/dashboard/trades/TradeSizingControls.tsx
      holdings_chart_source: app/dashboard/trades/OwnedPositionsChart.tsx
      displays: Trade records including strategy, closed trade count, realized P/L, recent LearningEvent rows, bid range controls, a live portfolio value/P&L graph, and a current holdings value chart below the KPI cards.
      sizing_behavior:
        - GET/POST /api/settings/trade-sizing controls paper research auto-trade min/max bid size.
        - Worker reads settings before each enabled loop.
      chart_behavior:
        - Server page seeds the chart with getPortfolioHistory(refresh=false, rangeHours=24).
        - Client chart polls GET /api/portfolio/history every 15 seconds without requiring page reload.
        - Range buttons show 6H, 24H, and 3D windows.
        - Chart displays current portfolio value, P/L in range, unrealized P/L, cash, latest timestamp, and Alpaca refresh errors when present.
      holdings_behavior:
        - Server page seeds the holdings chart with getPortfolioPositions.
        - Client chart polls GET /api/portfolio/positions every 15 seconds.
        - Displays current owned symbols, quantities, market values, unrealized P/L, and allocation bars.
    stocks:
      source: app/dashboard/stocks/page.tsx
      route: /dashboard/stocks
      dynamic: force-dynamic
      controls_sources: [app/dashboard/stocks/FocusStockControls.tsx, app/dashboard/stocks/StockSearchBuy.tsx]
      displays:
        - Ranked stocks sorted by optimism score from active opportunities, recent research, focused symbols, and current holdings.
        - Focus/unfocus controls backed by /api/focus-symbols.
        - Stock search by ticker or company name backed by /api/stocks/search.
        - Manual paper buy controls backed by /api/orders/manual-buy.
        - Catalyst, thesis, risk notes, source links, confidence, suggested action, and current holding value.
    research:
      source: app/dashboard/research/page.tsx
      route: /dashboard/research
      dynamic: force-dynamic
      displays: Active Opportunity rows and recent ResearchItem source rows.
  controls:
    source: app/dashboard/BotControls.tsx
    buttons:
      Enable: POST /api/bot/toggle {enabled:true}
      Disable: POST /api/bot/toggle {enabled:false}
      Dry Scan: POST /api/bot/scan {dryRun:true}
      Paper Scan: POST /api/bot/scan {dryRun:false}
      Cancel Orders: POST /api/orders/cancel-all
      Stop: POST /api/bot/emergency-stop
    note: Enable only toggles BotConfig. Scheduled execution requires separate `npm run bot:worker`.
  home:
    source: app/page.tsx
    behavior: route entry page.
  styles:
    source: app/globals.css
  layout:
    source: app/layout.tsx

cli_contract:
  scripts:
    scripts/alpaca-health.ts:
      behavior: print AlpacaBroker.healthCheck JSON.
    scripts/run-scan.ts:
      behavior: runBotScan; default dryRun true; `--paper` sets dryRun false; print ScanResult JSON.
    scripts/worker.ts:
      behavior: infinite loop; reads BotConfig enabled and trade.sizing; if enabled reconcileTrades, recordPortfolioSnapshot, runResearchAutoTrade dryRun false with runtime sizing, runBotScan dryRun false with runtime sizing, reconcileTrades again; logs trade sizing, portfolio snapshot, reconciliation, research auto-trade item outcomes, and per-symbol RSI final action/accepted; sleeps pollIntervalSeconds.
    scripts/reconcile-trades.ts:
      behavior: run reconcileTrades; optional `--days=N`; print ReconcileResult JSON.
    scripts/research-crawl.ts:
      behavior: run runResearchCrawl; optional `--symbols=AAPL,MSFT`, `--limit=N`, `--lookback-hours=N`; when --symbols is omitted it includes focused symbols from BotConfig; print ResearchCrawlResult JSON.
    scripts/research-auto-trade.ts:
      behavior: run runResearchAutoTrade once; optional `--dry-run`; print ResearchAutoTradeResult JSON.
    scripts/generate-plan.ts:
      behavior: run buildTradePlan; optional `--max-items=N`; print TradePlanResult JSON. Advisory only; does not scan RSI or place orders.
    scripts/db-push.mjs:
      behavior: direct Prisma db push wrapper used by npm run db:push.

railway_runtime_contract:
  config_source: .railway/railway.ts
  helper_docs:
    - .railway/README.md
    - .agents/skills/railway-config/SKILL.md
  sdk_dependency:
    package: railway
    version: "^3.4.1"
    node_engine_note: SDK declares node >=22; local repo tests/build currently run under Node 20, but Railway IaC evaluation succeeds.
  intended_services:
    web:
      start_command: npm start
      build_command: npm run build
      pre_deploy_command: npm run db:push
      purpose: Next dashboard and API routes.
    worker:
      start_command: npm run bot:worker
      build_command: npm run build
      purpose: Always-on paper research auto-trade loop, RSI scan loop, and reconciliation around scans.
    research_cron:
      start_command: npm run research:crawl
      build_command: npm run build
      cron_schedule_utc: "15 12-21/2 * * 1-5"
      purpose: Scheduled source-backed research ingestion; should exit when complete.
    plan_cron:
      start_command: npm run plan:generate
      build_command: npm run build
      cron_schedule_utc: "25 12-21/2 * * 1-5"
      purpose: Scheduled advisory plan generation shortly after research ingestion; should exit when complete.
    reconcile_cron_optional:
      start_command: npm run bot:reconcile
      build_command: npm run build
      cron_schedule_utc: "*/15 12-21 * * 1-5"
      purpose: Scheduled reconciliation when not relying only on worker.
  database: Railway PostgreSQL via DATABASE_URL.
  database_volume: branddbot-postgres-volume must remain represented in .railway/railway.ts to avoid destructive volume deletion plans.
  service_variables: Secrets are preserved in .railway/railway.ts with preserve(); cost-control variables pin OPENAI_REVIEW_HOLD_SIGNALS=false, BOT_POLL_INTERVAL_SECONDS=300, RESEARCH_MAX_SYMBOLS=8, RESEARCH_LOOKBACK_HOURS=6, RESEARCH_NEWS_LIMIT=20, RESEARCH_OPPORTUNITY_TTL_HOURS=24, RESEARCH_AUTO_TRADE_MAX_ITEMS_PER_RUN=1, RESEARCH_AUTO_TRADE_MAX_OPEN_POSITIONS=10, RESEARCH_AUTO_TRADE_MAX_DAILY_ORDERS=20, and RESEARCH_AUTO_TRADE_SYMBOL_COOLDOWN_MINUTES=240.
  build_command: npm run build
  deploy_source: GitHub auto-deploy after push to main.

safety_invariants:
  - Keep `.env` ignored and never expose secret values.
  - Current scaffold must remain Alpaca paper-only.
  - `TRADING_MODE=live`, `LIVE_TRADING_ENABLED=true`, or a non-paper Alpaca endpoint must not submit orders unless the risk model is explicitly redesigned.
  - OpenAI cannot create a buy/sell contrary to deterministic RSI.
  - OpenAI is skipped for deterministic RSI hold signals unless OPENAI_REVIEW_HOLD_SIGNALS=true.
  - Risk gate must require exact AI alignment with deterministic buy/sell.
  - Trade plans cannot create buy/sell orders and cannot bypass deterministic RSI, OpenAI review, or the RSI risk gate.
  - Deterministic hold always prevents RSI-scan order creation.
  - Dry scan must never submit broker orders.
  - Paper scan can submit only when RSI, AI, and risk gates all accept.
  - Research auto-trading can submit paper orders only when RESEARCH_AUTO_TRADE_ENABLED=true and its paper-only, source-backed, size, position, daily cap, loss, and cooldown gates pass.
  - Research auto-trading must label orders with strategy=research_auto and must not run in live mode.
  - Runtime trade.sizing can increase paper order size but cannot bypass paper-only mode, buying power, daily cap, cooldown, or symbol/position caps.
  - Manual buys from the Stocks page must be explicit user actions, must remain Alpaca paper-only, and must label orders with strategy=manual.
  - Emergency stop must disable bot and cancel open orders when Alpaca is reachable.
  - Suggested AI parameter adjustments are currently audit data only; they are not automatically applied.

training_learning_current:
  current_learning_loop:
    - Each AI decision includes learningUpdate with summary, rewardSignal, observations, mistakesToAvoid.
    - recordAiAudit stores learningUpdateJson.
    - Non-empty learningUpdate.summary becomes LearningEvent(source=openai).
    - Future scans include up to 8 priorLessons for same symbol in TradingContext.
    - reconcileTrades updates paper order fills and creates LearningEvent(source=alpaca_reconciliation) when filled sells close prior buys.
    - Future scans include up to 5 active researchBriefs for same symbol in TradingContext.
    - Research crawler stores source-backed ResearchItem rows and active Opportunity rows from Alpaca News.
    - Trade plan generation ranks active opportunities with current paper positions and recent LearningEvent rows, then stores advisory TradePlanItem rows for dashboard review.
    - Research auto-trading can create small paper Trade rows and LearningEvent(source=research_auto_trade) from source-backed opportunities when explicitly enabled.
    - Focused symbols add user-selected stocks to scheduled research and advisory plan watch items.
    - Manual user paper buys create Trade(strategy=manual) rows and LearningEvent(source=manual_order), then reconciliation can update fills/outcomes.
  limitations:
    - Closed-trade reconciliation is first-pass FIFO-style matching and does not yet track partial lot remaining quantity.
    - Some learning rewards are still model-estimated until a trade closes and reconciliation creates outcome events.
    - AI recommendedParameterAdjustments are stored but not applied.
    - No backtesting or walk-forward evaluation exists yet.
    - Research scoring is deterministic keyword scoring, not a trained market model.
    - Research source coverage is currently Alpaca News only.
    - Opportunity discovery uses RESEARCH_SYMBOLS or WATCHLIST fallback; it does not crawl arbitrary websites.
    - Trade plans remain advisory; research-driven order placement is isolated to the explicit research auto-trade executor.
    - Research auto-trade learning starts as a zero-reward action note until reconciliation and sell-side closure create realized outcome events.
    - Manual buy learning starts as a zero-reward action note until reconciliation and sell-side closure create realized outcome events.

intended_next_phase:
  user_goal: Run a paper bot that researches market opportunities, places frequent small paper trades from positive opportunities, keeps the original RSI/AI path intact, and learns from each paper action/outcome.
  recommended_sequence:
    1: Run the Postgres schema push against Railway DATABASE_URL.
    2: Configure Railway services with web, worker, and research cron commands.
    3: Collect paper-trading outcomes through worker scans and reconciliation before tuning parameters.
    4: Add backtest harness for RSI params and paper-vs-hypothetical outcome comparison.
    5: Add lot-level remaining quantity tracking for partial exits.
    6: Add more allowed research feeds with source URLs, timestamps, symbols, thesis, catalysts, risk flags, confidence, and expiry.
    7: Expand dashboard frequency/risk controls beyond bid sizing to map cadence, per-run count, position cap, daily cap, and cooldown.
    8: Add opportunity watchlist expansion for RSI scanning separately from research auto-trading.
  research_safety:
    - Web research can propose symbols or catalysts and can drive paper-only research auto-trades only through the explicit bounded executor.
    - Research data must be timestamped because market/news data decays quickly.
    - Cite/store source URLs for any research-derived opportunity.
    - Avoid trading on unsourced claims.

test_contract:
  tests:
    tests/bot-flow.test.ts:
      covers: scan flow with MockBroker, dryRun/order behavior, risk blocks.
    tests/ai-reasoning.test.ts:
      covers: AI parse/schema behavior and fallback paths.
    tests/plan-builder.test.ts:
      covers: advisory trade plan ranking, RSI eligibility, tradability explanations, and sell-candidate generation for negative research on an existing position.
    tests/research-auto-trade.test.ts:
      covers: paper-only research order selection outside WATCHLIST, live-mode block, and broker submission when enabled.
    tests/portfolio-snapshots.test.ts:
      covers: portfolio position summary math for long market value, unrealized P/L, open position count, and owned-position value allocation.
    tests/trade-sizing.test.ts:
      covers: dashboard bid range normalization and runtime application to bot/research auto-trade configs.
    tests/manual-order.test.ts:
      covers: explicit manual paper buy submission through a mock broker and paper-only safety block.
    tests/helpers.ts:
      covers: test env defaults.
  required_verification:
    docs_only: no test required, but `git diff --check` is useful.
    type_or_logic_change: run `npm run test` and `npm run lint`.
    route_or_build_change: also run `npm run build`.
    broker_or_external_api_change: run `npm run health:alpaca` only with network access and valid .env.

known_runtime_state_2026_07_06:
  verified:
    npm_run_health_alpaca: ok with Alpaca paper account ACTIVE
    npm_run_db_generate: ok
    npm_run_db_push: db already in sync
    npm_run_bot_scan: ok dryRun true; no orders; held/blocked due insufficient 5Min bars before market open
    npm_run_test: 7 files passed, 18 tests passed
    npm_run_lint: ok
    npm_run_build: ok
    localhost_dashboard: http://localhost:3000/dashboard returned 200
  caveat: This section is a point-in-time note and may become stale.
