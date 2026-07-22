import { decryptSecret } from "@/lib/crypto";
import type { PublishInput, PublishResult } from "@/lib/social/publish";

const VERSION = process.env.LINKEDIN_VERSION || "202606";

export async function publishLinkedIn(input: PublishInput): Promise<PublishResult> {
  const token = decryptSecret(input.account.access_token_encrypted);
  const author = input.account.external_account_id;
  if (!author?.startsWith("urn:li:")) throw new Error("LinkedIn autor musí být uložen jako person nebo organization URN");

  const mediaUrl = input.media.find(item => item.url.startsWith("https://"))?.url;
  const commentary = [input.caption.trim(), mediaUrl].filter(Boolean).join("\n\n");
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": VERSION,
    },
    body: JSON.stringify({
      author,
      commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.errorDetails?.message || `LinkedIn API (${response.status})`);
  const id = response.headers.get("x-restli-id") || body.id;
  if (!id) throw new Error("LinkedIn nevrátil ID příspěvku");
  return { externalPostId: String(id) };
}
