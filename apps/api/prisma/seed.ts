import { prisma } from "../src/shared/infrastructure/prisma/client.js";

const ORG_ID = "org-default";

async function main() {
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    create: { id: ORG_ID, name: "Default Club", timezone: "Asia/Manila" },
    update: {},
  });

  const players = [
    { id: "player-ana", displayName: "Ana" },
    { id: "player-ben", displayName: "Ben" },
    { id: "player-cara", displayName: "Cara" },
    { id: "player-dan", displayName: "Dan" },
  ];

  for (const player of players) {
    await prisma.playerProfile.upsert({
      where: { id: player.id },
      create: {
        id: player.id,
        organizationId: ORG_ID,
        displayName: player.displayName,
      },
      update: {},
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
