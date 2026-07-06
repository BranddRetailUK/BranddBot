import { defineRailway, github, group, postgres, preserve, project, service, volume } from "railway/iac";

const repo = github("BranddRetailUK/BranddBot", { branch: "main" });

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
    env: {
      DATABASE_URL: preserve()
    }
  });

  const worker = service("BranddBot Worker", {
    source: repo,
    build: "npm run build",
    start: "npm run bot:worker",
    replicas: 1,
    networking: { privateNetworkEndpoint: "branddbot-worker" },
    env: {
      DATABASE_URL: preserve()
    }
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
    env: {
      DATABASE_URL: preserve()
    }
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
    env: {
      DATABASE_URL: preserve()
    }
  });

  return project("Brandd Trading Bot", {
    resources: [
      database,
      databaseVolume,
      ...group("Runtime", [web, worker]),
      ...group("Schedules", [researchCron, reconcileCron])
    ]
  });
});
