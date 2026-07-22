import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptSecret } from "@/lib/crypto";
import { getSql, hasDatabaseConfig } from "@/lib/db";
import { SOCIAL_PLATFORMS } from "@/lib/social/platforms";

const schema = z.object({
  client_id: z.string().uuid(),
  platform: z.enum(SOCIAL_PLATFORMS),
  external_account_id: z.string().trim().min(1).max(300),
  account_name: z.string().trim().min(1).max(160),
  access_token: z.string().trim().min(10),
});

function redirect(request: Request, params: Record<string, string>) {
  const url = new URL("/settings", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const wantsHtml = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  try {
    const raw = wantsHtml
      ? Object.fromEntries((await request.formData()).entries())
      : await request.json();
    const input = schema.parse(raw);
    if (!hasDatabaseConfig()) throw new Error("DATABASE_URL není nastavené.");

    const sql = getSql();
    await sql`
      INSERT INTO social_accounts(
        client_id,
        platform,
        external_account_id,
        account_name,
        access_token_encrypted,
        connection_status
      )
      VALUES(
        ${input.client_id}::uuid,
        ${input.platform}::platform_name,
        ${input.external_account_id},
        ${input.account_name},
        ${encryptSecret(input.access_token)},
        'connected'
      )
      ON CONFLICT(client_id, platform) DO UPDATE SET
        external_account_id = EXCLUDED.external_account_id,
        account_name = EXCLUDED.account_name,
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        connection_status = 'connected',
        updated_at = NOW()
    `;

    if (wantsHtml) return redirect(request, { connected: input.platform });
    return NextResponse.json({ ok: true, platform: input.platform });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map(issue => issue.message).join(" ")
      : error instanceof Error ? error.message : "Connection error";
    if (wantsHtml) return redirect(request, { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
