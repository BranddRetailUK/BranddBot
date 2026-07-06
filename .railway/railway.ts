import { defineRailway, github, group, postgres, preserve, project, service, volume } from "railway/iac";

const repo = github("BranddRetailUK/BranddBot", { branch: "main" });

function preservedRuntimeEnv() {
  return {
    DATABASE_URL: preserve(),
    OPENAI_API_KEY: preserve(),
    OPENAI_MODEL: preserve(),
    OPENAI_REASONING_EFFORT: preserve(),
    OPENAI_TEXT_VERBOSITY: preserve(),
    OPENAI_STORE_RESPONSES: preserve(),
    APCA_API_KEY_ID: preserve(),
    APCA_API_SECRET_KEY: preserve(),
    APCA_API_BASE_URL: preserve(),
    ALPACA_DATA_BASE_URL: preserve(),
    TRADING_MODE: preserve(),
    LIVE_TRADING_ENABLED: preserve(),
    WATCHLIST: preserve(),
    RSI_PERIOD: preserve(),
    RSI_TIMEFRAME: preserve(),
    RSI_OVERSOLD: preserve(),
    RSI_OVERBOUGHT: preserve(),
    MIN_AI_CONFIDENCE: preserve(),
    MAX_NOTIONAL_PER_ORDER: preserve(),
    MAX_POSITION_NOTIONAL_PER_SYMBOL: preserve(),
    MAX_DAILY_LOSS_USD: preserve(),
    MAX_OPEN_POSITIONS: preserve(),
    BOT_POLL_INTERVAL_SECONDS: preserve()
  };
}

export default defineRailway(() => {
  const database = postgres("BranddBot Postgres");
  const databaseVolume = volume("branddbot-postgres-volume", {
    alerts: { usage: { "80": {}, "95": {}, "100": {} } },
    allowOnlineResize: true,
    region: "asia-southeast1-eqsg3a",
    sizeMB: 50000
  });

  const web = service("BranddBot", {
    source: repo,
    build: "npm run build",
    start: "npm start",
    preDeploy: "npm run db:push",
    replicas: 1,
    networking: { privateNetworkEndpoint: "branddbot" },
    env: preservedRuntimeEnv()
  });

  const worker = service("BranddBot Worker", {
    source: repo,
    build: "npm run build",
    start: "npm run bot:worker",
    replicas: 1,
    networking: { privateNetworkEndpoint: "branddbot-worker" },
    env: preservedRuntimeEnv()
  });

  const researchCron = service("BranddBot Research Cron", {
    source: repo,
    build: "npm run build",
    start: "npm run research:crawl",
    replicas: 1,
    deploy: {
      cronSchedule: "*/30 12-21 * * 1-5",
      restartPolicyType: "NEVER"
    },
    networking: { privateNetworkEndpoint: "branddbot-research-cron" },
    env: preservedRuntimeEnv()
  });

  const planCron = service("BranddBot Plan Cron", {
    source: repo,
    build: "npm run build",
    start: "npm run plan:generate",
    replicas: 1,
    deploy: {
      cronSchedule: "5,35 12-21 * * 1-5",
      restartPolicyType: "NEVER"
    },
    networking: { privateNetworkEndpoint: "branddbot-plan-cron" },
    env: preservedRuntimeEnv()
  });

  const reconcileCron = service("BranddBot Reconcile Cron", {
    source: repo,
    build: "npm run build",
    start: "npm run bot:reconcile",
    replicas: 1,
    deploy: {
      cronSchedule: "*/15 12-21 * * 1-5",
      restartPolicyType: "NEVER"
    },
    networking: { privateNetworkEndpoint: "branddbot-reconcile-cron" },
    env: preservedRuntimeEnv()
  });

  return project("Brandd Trading Bot", {
    resources: [
      database,
      databaseVolume,
      ...group("Runtime", [web, worker]),
      ...group("Schedules", [researchCron, planCron, reconcileCron])
    ]
  });
});
