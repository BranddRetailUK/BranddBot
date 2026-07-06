# BranddBot

AI-gated RSI paper-trading bot for US stocks/ETFs. The broker adapter targets Alpaca Paper Trading, OpenAI `gpt-5.5` is used as the reasoning layer through the Responses API, and Railway/Postgres is the intended always-on runtime.

This project is an experiment scaffold, not financial advice. Keep it in paper mode until you understand the broker, taxes, margin rules, and the bot's behavior.

## What Is Included

- Next.js dashboard with separate pages for overview, trade plans, AI decisions, paper trades, research, and beginner trading definitions.
- RSI baseline strategy with OpenAI reasoning that can only block, hold, or agree with deterministic RSI signals.
- Alpaca paper broker integration for account, positions, orders, IEX market data, fill reconciliation, and Alpaca News research.
- Postgres/Prisma persistence for market snapshots, signals, AI audits, trades, learning notes, research items, and opportunities.
- Research crawler that stores source-backed opportunities for AI context, plans, and optional paper-only research auto-trading.
- Trade plan builder that ranks opportunities against current paper positions and learning notes before anything is eligible for RSI scanning.
- Optional research auto-trade executor that can submit small Alpaca paper orders from positive source-backed opportunities while keeping RSI/OpenAI execution unchanged.
- Mockable services and tests for OpenAI parsing, risk gates, and scan flow.
- Git-ready defaults with `.env` ignored.

## Required Accounts

1. Create an OpenAI API key and paste it into `OPENAI_API_KEY`.
2. Create an Alpaca paper account and paste the paper keys into `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY`.
3. Add a Postgres `DATABASE_URL`. Railway Postgres is the expected hosted database.
4. Keep `TRADING_MODE=paper` and `LIVE_TRADING_ENABLED=false`.

Alpaca paper trading uses simulated fills. It is useful for software testing but does not model every live-market issue such as slippage, queue position, fees, or market impact.

## Setup

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

Open `http://localhost:3000/dashboard`.

## Useful Commands

```bash
npm run health:alpaca
npm run bot:scan
npm run bot:scan -- --paper
npm run bot:worker
npm run bot:reconcile
npm run research:crawl
npm run research:auto-trade
npm run plan:generate
npm run test
npm run lint
npm run build
```

`npm run bot:scan` runs a dry scan. Add `-- --paper` to allow a paper order if the RSI signal, OpenAI decision, and risk gates all approve it.

`npm run bot:reconcile` checks Alpaca for order fills and updates paper trade outcomes. `npm run research:crawl` imports Alpaca News, stores source links, and creates active opportunities for the dashboard and AI context. `npm run research:auto-trade` runs the paper-only research executor once; add `-- --dry-run` to preview accepted candidates without orders. `npm run plan:generate` builds an advisory trade plan from active opportunities, current paper positions, and recent learning notes.

## Railway Services

Use the same repository for each service, with different start commands:

- Web dashboard: `npm start`, with pre-deploy `npm run db:push`
- Market worker: `npm run bot:worker`
- Research cron: `npm run research:crawl`
- Trade plan cron: `npm run plan:generate`
- Reconciliation cron, optional if not using the worker: `npm run bot:reconcile`

The Railway project shape is defined in `.railway/railway.ts`. Run `railway config plan` before changing it, and apply only after confirming the plan has no unexpected deletes.

For high-frequency paper learning, the worker can run every 60 seconds and call the research auto-trade executor before the RSI scan. Useful non-secret runtime variables:

- `RESEARCH_AUTO_TRADE_ENABLED=true`
- `RESEARCH_AUTO_TRADE_NOTIONAL=1`
- `RESEARCH_AUTO_TRADE_MAX_ITEMS_PER_RUN=1`
- `RESEARCH_AUTO_TRADE_MAX_OPEN_POSITIONS=25`
- `RESEARCH_AUTO_TRADE_MAX_DAILY_ORDERS=100`
- `RESEARCH_AUTO_TRADE_SYMBOL_COOLDOWN_MINUTES=60`
- `BOT_POLL_INTERVAL_SECONDS=60`

## Safety Model

- OpenAI cannot override deterministic RSI strategy output.
- OpenAI cannot bypass max notional, max symbol exposure, max daily loss, watchlist, or paper-only mode.
- Broker order paths require `APCA_API_BASE_URL` to be an Alpaca paper endpoint.
- Missing OpenAI credentials block AI-gated execution.
- Missing Alpaca credentials block broker actions.
- The dashboard emergency stop disables the worker flag and cancels open Alpaca paper orders when credentials are available.
- Research opportunities cannot bypass live-trading safety. They can submit paper orders only through the explicit research auto-trade executor when enabled.
- Research auto-trading is paper-only, source-backed, size-limited, cooldown-limited, and recorded with `strategy=research_auto`.
- Trade plan items are advisory only. They rank candidates and explain tradability, but they cannot place orders or bypass RSI, OpenAI review, or the risk gate.

## Future Work

- Add historical backtests and walk-forward evaluation before considering any live mode.
- Add richer learning metrics based on closed trade P&L, hold time, drawdown, and missed opportunities.
- Add more research sources only through APIs/RSS/allowed feeds with source URLs and timestamps.
- Add a dashboard frequency/risk slider that maps to research auto-trade notional, cadence, candidate count, position cap, and cooldown settings.
