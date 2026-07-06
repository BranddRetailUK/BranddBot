import { AlpacaBroker } from "@/lib/broker/alpaca";

const broker = new AlpacaBroker();
const health = await broker.healthCheck();

console.log(JSON.stringify(health, null, 2));
process.exitCode = health.ok ? 0 : 1;
