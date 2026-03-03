#!/bin/sh
set -eu

APP_PORT="${APP_PORT:-3000}"
DB_PATH="/app/data/dev.db"

if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] first boot detected, initializing SQLite database..."
  mkdir -p /app/data
  sqlite3 "$DB_PATH" < /app/prisma/init.sql

  echo "[entrypoint] seeding default admin..."
  node <<'NODE'
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const prisma = new PrismaClient();
  const username = process.env.DEFAULT_ADMIN_USERNAME || "admin";
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "admin";

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log("[entrypoint] admin already exists");
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      username,
      passwordHash,
    },
  });
  console.log("[entrypoint] seeded default admin user");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
fi

echo "[entrypoint] starting Next.js on port ${APP_PORT}..."
exec npm run start -- -p "${APP_PORT}"
