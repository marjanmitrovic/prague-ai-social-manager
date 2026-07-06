import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!clientId) return NextResponse.json({ error: "Chybí clientId" }, { status: 400 });
  if (!appId || !redirectUri) return NextResponse.redirect(new URL("/settings?error=meta_config", request.url));

  const state = crypto.randomUUID();
  const sql = getSql();
  await sql`INSERT INTO oauth_states (state, client_id, platform, expires_at) VALUES (${state}, ${clientId}::uuid, 'instagram', NOW() + INTERVAL '10 minutes')`;

  const auth = new URL("https://www.instagram.com/oauth/authorize");
  auth.searchParams.set("client_id", appId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "instagram_business_basic,instagram_business_content_publish");
  auth.searchParams.set("state", state);
  auth.searchParams.set("force_authentication", "1");
  return NextResponse.redirect(auth);
}
