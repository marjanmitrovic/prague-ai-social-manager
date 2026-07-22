import { decryptSecret } from "@/lib/crypto";
import type { PublishInput, PublishResult } from "@/lib/social/publish";

export async function publishPinterest(input: PublishInput): Promise<PublishResult> {
  const token = decryptSecret(input.account.access_token_encrypted);
  const boardId = input.account.external_account_id;
  const first = input.media[0];
  if (!boardId) throw new Error("Pinterest board ID chybí");
  if (!first?.url?.startsWith("https://")) throw new Error("Pinterest vyžaduje veřejnou HTTPS adresu média");
  if (first.resourceType === "video") throw new Error("Pinterest video vyžaduje media upload workflow; použijte obrázek nebo ruční publikování");

  const response = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      board_id: boardId,
      title: (input.title || input.caption).slice(0, 100),
      description: input.caption.slice(0, 500),
      alt_text: input.caption.slice(0, 500),
      media_source: {
        source_type: "image_url",
        url: first.url,
      },
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.code) throw new Error(body.message || `Pinterest API (${response.status})`);
  if (!body.id) throw new Error("Pinterest nevrátil ID pinu");
  return { externalPostId: String(body.id) };
}
