#!/bin/sh
set -eu

APP_PORT="${APP_PORT:-3000}"
DATABASE_URL="${DATABASE_URL:-file:/app/data/dev.db}"
export DATABASE_URL

case "$DATABASE_URL" in
  file:*)
    DB_PATH="${DATABASE_URL#file:}"
    DB_PATH="${DB_PATH%%\?*}"
    case "$DB_PATH" in
      /*) ;;
      *) DB_PATH="/app/prisma/$DB_PATH" ;;
    esac
    ;;
  *)
    echo "[entrypoint] unsupported DATABASE_URL for bundled SQLite init: ${DATABASE_URL}" >&2
    exit 1
    ;;
esac

if [ ! -f "$DB_PATH" ] || [ "$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='User';")" != "User" ]; then
  echo "[entrypoint] missing SQLite schema, initializing database at ${DB_PATH}..."
  mkdir -p "$(dirname "$DB_PATH")"
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

if [ "$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM pragma_table_info('Evaluator') WHERE name='thinkingEnabled';")" = "0" ]; then
  echo "[entrypoint] adding missing Evaluator.thinkingEnabled column..."
  sqlite3 "$DB_PATH" 'ALTER TABLE "Evaluator" ADD COLUMN "thinkingEnabled" BOOLEAN NOT NULL DEFAULT false;'
fi

echo "[entrypoint] starting Next.js on port ${APP_PORT}..."
exec npm run start -- -p "${APP_PORT}"
