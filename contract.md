# CONTRACT_V1

repo:
  name: ai-rsi-trading-bot
  product_name: BranddBot
  description: AI-gated RSI paper-trading bot for US stocks/ETFs with outcome learning and source-backed research.
  status: paper_trading_research_plan_scaffold
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
    test_watch: "vitest"
    db_generate: "prisma generate"
    db_push: "node scripts/db-push.mjs"
    db_prisma_push: "prisma db push"
    bot_scan: "node --import tsx scripts/run-scan.ts"
    bot_worker: "node --import tsx scripts/worker.ts"
    bot_reconcile: "node --import tsx scripts/reconcile-trades.ts"
    research_crawl: "node --import tsx scripts/research-crawl.ts"
    plan_generate: "node --import tsx scripts/generate-plan.ts"
    health_alpaca: "node --import tsx scripts/alpaca-health.ts"
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
      runtime_min: 30
    RESEARCH_SYMBOLS:
      type: csv_symbols
      default: ""
      behavior: Empty uses WATCHLIST as fallback research symbols.
    RESEARCH_LOOKBACK_HOURS:
      type: number_string
      default: 24
      runtime_min: 1
    RESEARCH_NEWS_LIMIT:
      type: number_string
      default: 50
      runtime_clamp: [1, 50]
    RESEARCH_OPPORTUNITY_TTL_HOURS:
      type: number_string
      default: 72
      runtime_min: 1
    RESEARCH_MIN_CONFIDENCE:
      type: number_string
      default: 0.35
      runtime_clamp: [0, 1]
    DATABASE_URL:
      type: string
      purpose: Prisma PostgreSQL URL, normally Railway Postgres in hosted environments.
  helpers:
    getEnv: zod parse of process.env.
    isOpenAiConfigured: OPENAI_API_KEY non-empty.
    isAlpacaConfigured: APCA_API_KEY_ID and APCA_API_SECRET_KEY non-empty.
    getBotRuntimeConfig: converts env into BotRuntimeConfig.
    getResearchRuntimeConfig: converts env into research crawler config.
    getPublicRuntimeSummary: safe dashboard summary without secrets.

data_model:
  source: prisma/schema.prisma
  datasource: postgresql
  models:
    BotConfig:
      key: String id
      value: String
      updatedAt: DateTime updatedAt
      use: Stores runtime flags, currently bot enabled state.
    MarketSnapshot:
      fields: [id, symbol, timeframe, price, rsi, barsJson, createdAt]
      indexes: [[symbol, createdAt]]
      use: Persist scan market data and raw bars JSON.
    Signal:
      fields: [id, symbol, action, confidence, rsi, reason, recommendedNotional, createdAt]
      indexes: [[symbol, createdAt]]
      use: Persist deterministic RSI signal before AI/risk gate.
    AiAudit:
      fields: [id, symbol, promptHash, inputJson, outputJson, decision, confidence, rationale, riskFlagsJson, learningUpdateJson, recommendedAdjustmentsJson, accepted, rejectionReasonsJson, tradeOutcomeJson, openAiResponseId, createdAt]
      indexes: [[symbol, createdAt], [createdAt]]
      use: Full audit of AI decision, risk gate, and optional order result.
    Trade:
      fields: [id, symbol, side, qty, notional, price, orderId, status, realizedPnl, rationale, tradeOutcomeJson, filledAt, reconciledAt, createdAt, closedAt]
      indexes: [[symbol, createdAt], [orderId], [status, createdAt]]
      use: Records submitted paper orders, reconciled fills, and realized outcomes.
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
    MarketBar: { timestamp, open, high, low, close, volume }
    AccountSnapshot: { id?, status?, currency?, buyingPower, cash, portfolioValue }
    PositionSnapshot: { symbol, qty, marketValue, avgEntryPrice, unrealizedPnl }
    OrderRequest: { symbol, side, notional?, qty?, type?, timeInForce?, clientOrderId? }
    OrderResult: { id, symbol, side, status, notional?, qty?, filledAvgPrice? }
    BrokerOrderSnapshot: OrderResult plus { filledAt?, submittedAt? }
    TradeFillActivity: { id, orderId?, symbol, side, qty, price, transactionTime }
    RsiSignal: { symbol, action: buy_or_sell_or_hold, rsi?, previousRsi?, confidence, reason, recommendedNotional? }
    RiskLimits: { maxNotionalPerOrder, maxPositionNotionalPerSymbol, maxDailyLossUsd, maxOpenPositions, minAiConfidence }
    BotRuntimeConfig: { watchlist, rsiPeriod, timeframe, oversoldThreshold, overboughtThreshold, tradingMode, liveTradingEnabled, pollIntervalSeconds, risk }
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
    TradePlanSuggestedAction: ["watch", "buy_candidate", "sell_candidate", "avoid"]
    TradePlanItemSummary: { rank, symbol, suggestedAction, thesis, catalyst, confidence, score, riskNotes, eligibleForRsi, tradableNow, tradabilityReason, opportunityIds, sourceUrls, learningNotes, position? }
    TradePlanResult: { id, status, generatedAt, createdAt, inputSummary, items }

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

research_contract:
  sources: [lib/research/alpacaNews.ts, lib/research/scoring.ts, lib/research/crawl.ts]
  news_provider: Alpaca Market Data News API
  endpoint: ALPACA_DATA_BASE_URL + "/v1beta1/news"
  crawl_function: runResearchCrawl
  script: npm run research:crawl
  query:
    symbols: RESEARCH_SYMBOLS or WATCHLIST fallback
    start: now minus RESEARCH_LOOKBACK_HOURS
    limit: RESEARCH_NEWS_LIMIT clamped 1..50
    include_content: false
    exclude_contentless: false
  storage:
    - Upsert ResearchItem by externalId "{article.id}:{symbol}".
    - Store source URL, headline, source, published timestamp, symbols JSON, content hash, sentiment, catalyst, risk flags, confidence, expiry.
    - Expire old Opportunity rows before each crawl.
    - Create/update active Opportunity rows by symbol and direction when confidence >= RESEARCH_MIN_CONFIDENCE.
  scoring:
    type: deterministic keyword classifier.
    directions: bullish, bearish, watch.
    positive_terms_examples: [approval, beat, buyback, contract, guidance raised, launch, partnership, upgrade]
    risk_terms_examples: [bankruptcy, downgrade, investigation, lawsuit, miss, probe, recall, warning]
  invariant:
    Research opportunities are advisory context only. They cannot create or approve trades without RSI and risk-gate alignment.

trade_plan_contract:
  source: lib/plan/builder.ts
  function: buildTradePlan
  script: npm run plan:generate
  inputs:
    - Active Opportunity rows where status=active and expiresAt > now.
    - Current paper positions from AlpacaBroker.getPositions when Alpaca credentials are configured; falls back to no positions if unavailable.
    - Recent LearningEvent rows for candidate symbols.
    - BotRuntimeConfig watchlist and risk limits.
  ranking:
    - Candidate symbols come from active opportunities plus current long positions.
    - Net research score sums opportunity scores per symbol and clamps to [-1, 1].
    - Suggested action is buy_candidate for positive research without an existing position, sell_candidate for negative research with an existing long position, avoid for negative research without a long position, and watch otherwise.
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
      - eligibleForRsi: symbol is in WATCHLIST
      - tradableNow/tradabilityReason: high-level paper eligibility explanation only
  persistence:
    - buildTradePlan supersedes prior active TradePlan rows and creates one active TradePlan with TradePlanItem children.
    - getLatestTradePlan reads the newest generated plan with items ordered by rank.
  invariant:
    Trade plans are advisory only. Plan items do not submit orders, do not invoke risk gate acceptance, and are not called from runBotScan.

risk_gate_contract:
  source: lib/bot/risk.ts
  function: evaluateRiskGate
  inputs: signal, aiDecision, context, config, dryRun
  hard_blocks:
    - config.tradingMode != paper OR config.liveTradingEnabled true => reason live trading disabled.
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
      - aiDecision = AIReasoningService.reason(context)
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
    recordTrade: creates Trade from OrderResult and rationale.
  noop: createNoopScanPersistence for tests.

api_contract:
  next_app_router:
    GET /api/health/alpaca:
      source: app/api/health/alpaca/route.ts
      behavior: AlpacaBroker.healthCheck; status 200 if ok else 400.
    GET /api/account:
      source: app/api/account/route.ts
      behavior: healthCheck then account and positions; status 400 if health fails.
    POST /api/bot/scan:
      source: app/api/bot/scan/route.ts
      body: { dryRun?: boolean }
      default: dryRun true
      behavior: runBotScan; response message contains Dry/Paper and accepted decision count; status 500 on error.
    GET /api/bot/status:
      source: app/api/bot/status/route.ts
      behavior: returns enabled, runtime public summary, latestAudit.
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
      top_nav_routes: [/dashboard, /dashboard/plan, /dashboard/decisions, /dashboard/trades, /dashboard/research, /dashboard/guide]
    overview:
      source: app/dashboard/page.tsx
      route: /dashboard
      dynamic: force-dynamic
      reads:
        - getBotEnabled
        - latest AiAudit
        - active Opportunity count
        - open Trade count
        - getPublicRuntimeSummary
      displays:
        - badges for PAPER/LIVE, OpenAI configured/missing, Alpaca configured/missing, Enabled/Paused
        - model, watchlist, max order, active opportunity count
        - controls
        - latest AI decision
        - beginner-friendly explanations for RSI, watchlist, risk gate, open paper trades, research symbols, max position size
    decisions:
      source: app/dashboard/decisions/page.tsx
      route: /dashboard/decisions
      dynamic: force-dynamic
      displays: Recent AiAudit rows with decision, confidence, accepted status, rationale, rejection reasons.
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
        - Ranked table with candidate symbol, suggested action, confidence, thesis, catalyst/news reason, source links, risk notes, RSI eligibility, tradableNow, and tradability reason.
    trades:
      source: app/dashboard/trades/page.tsx
      route: /dashboard/trades
      dynamic: force-dynamic
      displays: Trade records, closed trade count, realized P/L, recent LearningEvent rows.
    research:
      source: app/dashboard/research/page.tsx
      route: /dashboard/research
      dynamic: force-dynamic
      displays: Active Opportunity rows and recent ResearchItem source rows.
    guide:
      source: app/dashboard/guide/page.tsx
      route: /dashboard/guide
      dynamic: static
      displays: Beginner-friendly definitions for paper trading, symbol, ETF, RSI, oversold, overbought, notional, position, realized P/L, risk gate, catalyst, confidence.
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
      behavior: infinite loop; reads BotConfig enabled; if enabled reconcileTrades before and after runBotScan dryRun false; logs reconciliation and per-symbol final action/accepted; sleeps pollIntervalSeconds.
    scripts/reconcile-trades.ts:
      behavior: run reconcileTrades; optional `--days=N`; print ReconcileResult JSON.
    scripts/research-crawl.ts:
      behavior: run runResearchCrawl; optional `--symbols=AAPL,MSFT`, `--limit=N`, `--lookback-hours=N`; print ResearchCrawlResult JSON.
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
      purpose: Always-on paper scan loop and reconciliation around scans.
    research_cron:
      start_command: npm run research:crawl
      build_command: npm run build
      cron_schedule_utc: "*/30 12-21 * * 1-5"
      purpose: Scheduled source-backed research ingestion; should exit when complete.
    plan_cron:
      start_command: npm run plan:generate
      build_command: npm run build
      cron_schedule_utc: "5,35 12-21 * * 1-5"
      purpose: Scheduled advisory plan generation shortly after research ingestion; should exit when complete.
    reconcile_cron_optional:
      start_command: npm run bot:reconcile
      build_command: npm run build
      cron_schedule_utc: "*/15 12-21 * * 1-5"
      purpose: Scheduled reconciliation when not relying only on worker.
  database: Railway PostgreSQL via DATABASE_URL.
  database_volume: branddbot-postgres-volume must remain represented in .railway/railway.ts to avoid destructive volume deletion plans.
  service_variables: Existing runtime variables are preserved in .railway/railway.ts with preserve(); OpenAI and Alpaca secrets must remain Railway variables or be set in Railway without committing values. BranddBot Plan Cron preserves its own runtime variables without committing values.
  build_command: npm run build
  deploy_source: GitHub auto-deploy after push to main.

safety_invariants:
  - Keep `.env` ignored and never expose secret values.
  - Current scaffold must remain Alpaca paper-only.
  - `TRADING_MODE=live` or `LIVE_TRADING_ENABLED=true` must not submit orders unless the risk model is explicitly redesigned.
  - OpenAI cannot create a buy/sell contrary to deterministic RSI.
  - Risk gate must require exact AI alignment with deterministic buy/sell.
  - Trade plans cannot create buy/sell orders and cannot bypass deterministic RSI, OpenAI review, or the risk gate.
  - Deterministic hold always prevents order creation.
  - Dry scan must never submit broker orders.
  - Paper scan can submit only when RSI, AI, and risk gates all accept.
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
  limitations:
    - Closed-trade reconciliation is first-pass FIFO-style matching and does not yet track partial lot remaining quantity.
    - Some learning rewards are still model-estimated until a trade closes and reconciliation creates outcome events.
    - AI recommendedParameterAdjustments are stored but not applied.
    - No backtesting or walk-forward evaluation exists yet.
    - Research scoring is deterministic keyword scoring, not a trained market model.
    - Research source coverage is currently Alpaca News only.
    - Opportunity discovery uses RESEARCH_SYMBOLS or WATCHLIST fallback; it does not crawl arbitrary websites.
    - Trade plans are advisory and do not yet make positive research opportunities directly place paper trades.

intended_next_phase:
  user_goal: Run an RSI bot that learns from trades and does web research to find potential market opportunities.
  recommended_sequence:
    1: Run the Postgres schema push against Railway DATABASE_URL.
    2: Configure Railway services with web, worker, and research cron commands.
    3: Collect paper-trading outcomes through worker scans and reconciliation before tuning parameters.
    4: Add backtest harness for RSI params and paper-vs-hypothetical outcome comparison.
    5: Add lot-level remaining quantity tracking for partial exits.
    6: Add more allowed research feeds with source URLs, timestamps, symbols, thesis, catalysts, risk flags, confidence, and expiry.
    7: Add opportunity watchlist expansion as advisory only; deterministic strategy and risk gates still decide entries.
    8: If research-driven positive opportunities should trigger paper entries, redesign the safety model first so execution remains paper-only, risk-limited, auditable, and cannot be forced by unsourced research.
  research_safety:
    - Web research can propose symbols or catalysts but must not bypass deterministic RSI or risk gates.
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
    npm_run_test: 2 files passed, 5 tests passed
    npm_run_lint: ok
    npm_run_build: ok with Postgres-shaped DATABASE_URL override
    localhost_dashboard: http://localhost:3000/dashboard returned 200
  caveat: This section is a point-in-time note and may become stale.
