import { getSql } from "@/lib/db";

let migration: Promise<void> | null = null;

async function runMigration() {
  const sql = getSql();
  await sql`ALTER TYPE platform_name ADD VALUE IF NOT EXISTS 'facebook'`;
  await sql`ALTER TYPE platform_name ADD VALUE IF NOT EXISTS 'linkedin'`;
  await sql`ALTER TYPE platform_name ADD VALUE IF NOT EXISTS 'x'`;
  await sql`ALTER TYPE platform_name ADD VALUE IF NOT EXISTS 'youtube'`;
  await sql`ALTER TYPE platform_name ADD VALUE IF NOT EXISTS 'threads'`;
  await sql`ALTER TYPE platform_name ADD VALUE IF NOT EXISTS 'pinterest'`;
  await sql`ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'manual_action'`;
  await sql`ALTER TABLE post_targets ADD COLUMN IF NOT EXISTS platform_caption TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_post_targets_platform_status ON post_targets(platform, status)`;
}

export function ensureMultiplatformSchema() {
  if (!migration) {
    migration = runMigration().catch(error => {
      migration = null;
      throw error;
    });
  }
  return migration;
}
