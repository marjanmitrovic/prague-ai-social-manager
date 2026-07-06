import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql, hasDatabaseConfig } from "@/lib/db";

const demoClients = [
  { id: "demo-1", name: "Manifesto Market", industry: "gastro", timezone: "Europe/Prague", requires_approval: false, created_at: new Date().toISOString() },
  { id: "demo-2", name: "Demo Café", industry: "café", timezone: "Europe/Prague", requires_approval: false, created_at: new Date().toISOString() },
  { id: "demo-3", name: "Bistro 21", industry: "restaurant", timezone: "Europe/Prague", requires_approval: false, created_at: new Date().toISOString() }
];

const inputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  industry: z.string().trim().min(2).max(80).default("gastro"),
  timezone: z.string().trim().default("Europe/Prague"),
  requires_approval: z.boolean().default(false)
});

export async function GET() {
  try {
    if (!hasDatabaseConfig()) {
      return NextResponse.json({ data: demoClients, demo: true });
    }

    const sql = getSql();
    const data = await sql`
      SELECT id, name, industry, timezone, requires_approval, created_at
      FROM clients
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ data, demo: false });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());

    if (!hasDatabaseConfig()) {
      return NextResponse.json(
        { data: { id: crypto.randomUUID(), ...input, created_at: new Date().toISOString() }, demo: true },
        { status: 201 }
      );
    }

    const sql = getSql();
    const rows = await sql`
      INSERT INTO clients (name, industry, timezone, requires_approval)
      VALUES (${input.name}, ${input.industry}, ${input.timezone}, ${input.requires_approval})
      RETURNING id, name, industry, timezone, requires_approval, created_at
    `;

    return NextResponse.json({ data: rows[0], demo: false }, { status: 201 });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(", ")
      : error instanceof Error ? error.message : "Invalid input";
    return NextResponse.json({ error: message }, { status });
  }
}
