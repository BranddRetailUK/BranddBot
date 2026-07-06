import { prisma } from "@/lib/db/prisma";

export async function getBotEnabled(): Promise<boolean> {
  const row = await prisma.botConfig.findUnique({ where: { key: "bot.enabled" } });
  return row?.value === "true";
}

export async function setBotEnabled(enabled: boolean): Promise<void> {
  await prisma.botConfig.upsert({
    where: { key: "bot.enabled" },
    update: { value: String(enabled) },
    create: { key: "bot.enabled", value: String(enabled) }
  });
}
