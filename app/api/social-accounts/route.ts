import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT c.id AS client_id, c.name AS client_name, sa.platform, sa.account_name,
             sa.connection_status, sa.token_expires_at
      FROM clients c
      LEFT JOIN social_accounts sa ON sa.client_id = c.id
      ORDER BY c.name, sa.platform
    `;
    return NextResponse.json({ data: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
