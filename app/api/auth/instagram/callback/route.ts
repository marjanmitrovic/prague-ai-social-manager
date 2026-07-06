import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

function getAppOrigin(request: Request) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  return new URL(request.url).origin;
}

function redirectToSettings(request: Request, params: Record<string, string>) {
  const url = new URL("/settings", getAppOrigin(request));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const current = new URL(request.url);
  const code = current.searchParams.get("code");
  const state = current.searchParams.get("state");
  const oauthError = current.searchParams.get("error_description") || current.searchParams.get("error");

  if (oauthError) return redirectToSettings(request, { error: oauthError });
  if (!code || !state) return redirectToSettings(request, { error: "missing_oauth_data" });

  try {
    const sql = getSql();
    const states = await sql`
      DELETE FROM oauth_states
      WHERE state = ${state}
        AND platform = 'instagram'
        AND expires_at > NOW()
      RETURNING client_id
    `;
    if (!states[0]) throw new Error("OAuth relace vypršela. Zkuste připojení znovu.");

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = process.env.META_REDIRECT_URI;
    if (!appId || !appSecret || !redirectUri) throw new Error("Meta OAuth není nastavené.");

    const tokenForm = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });

    const shortResponse = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: tokenForm,
      cache: "no-store",
    });
    const short = await shortResponse.json();
    if (!shortResponse.ok || short.error_message || short.error) {
      throw new Error(short.error_message || short.error?.message || "Instagram token exchange selhal");
    }

    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("access_token", short.access_token);
    const longResponse = await fetch(longUrl, { cache: "no-store" });
    const long = await longResponse.json();
    if (!longResponse.ok || long.error) {
      throw new Error(long.error?.message || "Long-lived Instagram token selhal");
    }

    const accessToken = long.access_token || short.access_token;
    const profileUrl = new URL("https://graph.instagram.com/me");
    profileUrl.searchParams.set("fields", "user_id,username,account_type");
    profileUrl.searchParams.set("access_token", accessToken);
    const profileResponse = await fetch(profileUrl, { cache: "no-store" });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || profile.error) {
      throw new Error(profile.error?.message || "Instagram profil nelze načíst");
    }

    const externalId = String(profile.user_id || profile.id || short.user_id);
    const expiresAt = new Date(Date.now() + Number(long.expires_in || 5184000) * 1000).toISOString();

    await sql`
      INSERT INTO social_accounts (
        client_id, platform, external_account_id, account_name,
        access_token_encrypted, token_expires_at, connection_status
      )
      VALUES (
        ${states[0].client_id}::uuid, 'instagram', ${externalId},
        ${profile.username || "Instagram"}, ${encryptSecret(accessToken)},
        ${expiresAt}::timestamptz, 'connected'
      )
      ON CONFLICT (client_id, platform) DO UPDATE SET
        external_account_id = EXCLUDED.external_account_id,
        account_name = EXCLUDED.account_name,
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        token_expires_at = EXCLUDED.token_expires_at,
        connection_status = 'connected',
        updated_at = NOW()
    `;

    return redirectToSettings(request, { connected: "instagram" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth chyba";
    console.error("Instagram OAuth callback error:", error);
    return redirectToSettings(request, { error: message });
  }
}
