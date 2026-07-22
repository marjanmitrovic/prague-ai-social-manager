import { decryptSecret } from "@/lib/crypto";
import type { PublishInput, PublishResult } from "@/lib/social/publish";

function textWithMedia(caption: string, mediaUrl?: string) {
  if (!mediaUrl) return caption.slice(0, 280);
  const available = 250;
  const clean = caption.length > available ? `${caption.slice(0, available - 1).trimEnd()}…` : caption;
  return `${clean}\n${mediaUrl}`;
}

export async function publishX(input: PublishInput): Promise<PublishResult> {
  const token = decryptSecret(input.account.access_token_encrypted);
  const mediaUrl = input.media.find(item => item.url.startsWith("https://"))?.url;
  const response = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: textWithMedia(input.caption.trim(), mediaUrl) }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors?.length) {
    throw new Error(body.detail || body.errors?.[0]?.detail || body.title || `X API (${response.status})`);
  }
  if (!body.data?.id) throw new Error("X nevrátil ID příspěvku");
  return { externalPostId: String(body.data.id) };
}
