import "dotenv/config";
import { prisma } from "./src/lib/prisma.js";

async function main() {
  const search = process.argv[2] ?? "10";

  const where = {
    OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { description: { contains: search, mode: "insensitive" as const } },
      { type: { contains: search, mode: "insensitive" as const } },
      { row: { contains: search, mode: "insensitive" as const } },
    ],
  };

  const rooms = await prisma.room.findMany({ where, take: 5 });
  console.log("search:", JSON.stringify(search));
  console.log("count:", rooms.length);
  console.log(rooms.map((r) => `${r.name} | ${r.type} | ${r.row}`));

  const all = await prisma.room.findMany({ take: 5 });
  console.log("total rooms:", await prisma.room.count());
  console.log(all.map((r) => `${r.name} | ${r.type} | ${r.row}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
