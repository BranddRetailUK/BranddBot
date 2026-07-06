# BranddBot

AI-gated RSI paper-trading scaffold for US stocks/ETFs. The first broker adapter targets Alpaca Paper Trading, and OpenAI `gpt-5.5` is used as the reasoning layer through the Responses API.

This project is an experiment scaffold, not financial advice. Keep it in paper mode until you understand the broker, taxes, margin rules, and the bot's behavior.

## What Is Included

- Next.js dashboard for bot status, controls, AI decisions, risk-gate outcomes, and paper trades.
- RSI baseline strategy with OpenAI reasoning that can only block, hold, or agree with deterministic RSI signals.
- Alpaca paper broker integration for account, positions, orders, and IEX market data.
- SQLite/Prisma persistence for market snapshots, signals, AI audits, trades, and learning notes.
- Mockable services and tests for OpenAI parsing, risk gates, and scan flow.
- Git-ready defaults with `.env` ignored.

## Required Accounts

1. Create an OpenAI API key and paste it into `OPENAI_API_KEY`.
2. Create an Alpaca paper account and paste the paper keys into `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY`.
3. Keep `TRADING_MODE=paper` and `LIVE_TRADING_ENABLED=false`.

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
npm run test
npm run lint
npm run build
```

`npm run bot:scan` runs a dry scan. Add `-- --paper` to allow a paper order if the RSI signal, OpenAI decision, and risk gates all approve it.

## Safety Model

- OpenAI cannot override deterministic RSI strategy output.
- OpenAI cannot bypass max notional, max symbol exposure, max daily loss, watchlist, or paper-only mode.
- Missing OpenAI credentials block AI-gated execution.
- Missing Alpaca credentials block broker actions.
- The dashboard emergency stop disables the worker flag and cancels open Alpaca paper orders when credentials are available.

## Future Work

- Add OANDA practice adapter for FX after the stock/ETF paper loop is stable.
- Add historical backtests and walk-forward evaluation before considering any live mode.
- Add scheduled reconciliation against Alpaca activities and fills.
- Add richer learning metrics based on closed trade P&L, hold time, drawdown, and missed opportunities.
