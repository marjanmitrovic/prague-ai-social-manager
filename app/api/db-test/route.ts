import { NextResponse } from "next/server";
import { getSql, hasDatabaseConfig } from "@/lib/db";

export async function GET() {
  try {
    if (!hasDatabaseConfig()) {
      return NextResponse.json(
        { ok: false, error: "DATABASE_URL nije pravilno podešen" },
        { status: 500 }
      );
    }

    const sql = getSql();
    const rows = await sql`
      SELECT NOW() AS database_time, current_database() AS database_name
    `;

    return NextResponse.json({
      ok: true,
      databaseTime: rows[0].database_time,
      databaseName: rows[0].database_name
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Database error" },
      { status: 500 }
    );
  }
}
