# CONTRACT_V1

repo:
  name: ai-rsi-trading-bot
  product_name: BranddBot
  description: AI-gated RSI paper-trading scaffold for US stocks/ETFs.
  status: scaffold
  language: TypeScript
  module_system: ESM
  framework: Next.js App Router
  ui_runtime: React
  db: SQLite via Prisma
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
    build: "prisma generate && next build"
    lint: "eslint ."
    test: "vitest run"
    test_watch: "vitest"
    db_generate: "prisma generate"
    db_push: "node scripts/db-push.mjs"
    db_prisma_push: "prisma db push"
    bot_scan: "node --import tsx scripts/run-scan.ts"
    bot_worker: "node --import tsx scripts/worker.ts"
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
    DATABASE_URL:
      type: string
      purpose: Prisma SQLite URL, normally file:./dev.db.
  helpers:
    getEnv: zod parse of process.env.
    isOpenAiConfigured: OPENAI_API_KEY non-empty.
    isAlpacaConfigured: APCA_API_KEY_ID and APCA_API_SECRET_KEY non-empty.
    getBotRuntimeConfig: converts env into BotRuntimeConfig.
    getPublicRuntimeSummary: safe dashboard summary without secrets.

data_model:
  source: prisma/schema.prisma
  datasource: sqlite
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
      fields: [id, symbol, side, qty, notional, price, orderId, status, realizedPnl, rationale, createdAt, closedAt]
      indexes: [[symbol, createdAt]]
      use: Records submitted paper orders and later trade outcomes.
    LearningEvent:
      fields: [id, symbol, reward, summary, source, createdAt]
      indexes: [[symbol, createdAt]]
      use: Stores AI learning summaries used as priorLessons in future scans.

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
    RsiSignal: { symbol, action: buy_or_sell_or_hold, rsi?, previousRsi?, confidence, reason, recommendedNotional? }
    RiskLimits: { maxNotionalPerOrder, maxPositionNotionalPerSymbol, maxDailyLossUsd, maxOpenPositions, minAiConfidence }
    BotRuntimeConfig: { watchlist, rsiPeriod, timeframe, oversoldThreshold, overboughtThreshold, tradingMode, liveTradingEnabled, pollIntervalSeconds, risk }
    TradingContext: { symbol, generatedAt, currentPrice, barSummary, rsi, deterministicSignal, position?, account, openPositionsCount, recentTrades, realizedPnlToday, riskLimits, priorLessons }
    AiTradingDecision: { decision, confidence, rationale, riskFlags, learningUpdate, recommendedParameterAdjustments }
    AiDecisionResult: AiTradingDecision plus { configured, promptHash, inputJson, outputJson, openAiResponseId? }
    RiskGateResult: { accepted, finalAction, reasons, order? }
    ScanSymbolResult: { symbol, signal, aiDecision, riskGate, order? }
    ScanResult: { startedAt, finishedAt, dryRun, tradingMode, symbols }

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
    [symbol, generatedAt, currentPrice, barSummary, rsi, deterministicSignal, position_or_null, account.buyingPower, account.cash, account.portfolioValue, openPositionsCount, recentTrades_first_8, realizedPnlToday, riskLimits, priorLessons_first_8]
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
    cancelAllOrders: client.cancelAllOrders.
  mock_source: lib/broker/mock.ts
  mock_behavior:
    in_memory_account: ACTIVE USD 1000
    positions: mutable array
    bars: mutable symbol map
    submitOrder: appends accepted mock order with optional last close as filledAvgPrice.

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
      - fetch recentTrades and priorLessons
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
      output: symbol, side, notional, realizedPnl, status, createdAt iso
    getPriorLessons:
      query: LearningEvent by symbol desc take 8
      output: summary strings
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

ui_contract:
  dashboard:
    source: app/dashboard/page.tsx
    route: /dashboard
    dynamic: force-dynamic
    reads:
      - getBotEnabled
      - latest 12 AiAudit rows desc
      - latest 8 Trade rows desc
      - getPublicRuntimeSummary
    displays:
      - badges for PAPER/LIVE, OpenAI configured/missing, Alpaca configured/missing, Enabled/Paused
      - model, watchlist, max order, accepted audit count
      - controls
      - latest AI decision
      - audit table
      - recent paper trades
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
      behavior: infinite loop; reads BotConfig enabled; if enabled runBotScan dryRun false; logs per-symbol final action and accepted; sleeps pollIntervalSeconds.
    scripts/db-push.mjs:
      behavior: Prisma db push wrapper used by npm run db:push.

safety_invariants:
  - Keep `.env` ignored and never expose secret values.
  - Current scaffold must remain Alpaca paper-only.
  - `TRADING_MODE=live` or `LIVE_TRADING_ENABLED=true` must not submit orders unless the risk model is explicitly redesigned.
  - OpenAI cannot create a buy/sell contrary to deterministic RSI.
  - Risk gate must require exact AI alignment with deterministic buy/sell.
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
  limitations:
    - No automatic closed-trade reconciliation yet.
    - Trade.realizedPnl is not backfilled from Alpaca activities yet.
    - Learning reward is model-estimated, not verified by realized PnL.
    - AI recommendedParameterAdjustments are stored but not applied.
    - No backtesting or walk-forward evaluation exists yet.
    - No web research ingestion exists yet.
    - No opportunity discovery beyond configured WATCHLIST exists yet.

intended_next_phase:
  user_goal: Run an RSI bot that learns from trades and does web research to find potential market opportunities.
  recommended_sequence:
    1: Add broker reconciliation to update Trade fills, closedAt, realizedPnl, and tradeOutcomeJson from Alpaca activities/orders.
    2: Convert LearningEvent rewardSignal to use realized outcomes after position close.
    3: Add explicit ResearchItem/Opportunity data model before using web research in trading context.
    4: Add research ingestion with source URLs, timestamps, symbols, thesis, catalysts, risk flags, confidence, and expiry.
    5: Add opportunity watchlist expansion as advisory only; deterministic strategy and risk gates still decide entries.
    6: Add backtest harness for RSI params and paper-vs-hypothetical outcome comparison.
    7: Add dashboard views for research/opportunities and closed trade learning metrics.
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
    npm_run_build: ok
    localhost_dashboard: http://localhost:3000/dashboard returned 200
  caveat: This section is a point-in-time note and may become stale.
