import { decryptSecret } from "@/lib/crypto";
import { PublishInput, PublishResult } from "@/lib/social/publish";

const VERSION = process.env.META_GRAPH_API_VERSION || "v24.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

async function graph(path: string, params: URLSearchParams) {
  const response = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(body.error?.message || `Facebook API (${response.status})`);
  return body;
}

export async function publishFacebook(input: PublishInput): Promise<PublishResult> {
  const token = decryptSecret(input.account.access_token_encrypted);
  const pageId = input.account.external_account_id;
  if (!pageId) throw new Error("Facebook Page ID chybí");
  const assets = input.media.filter(item => item.url.startsWith("https://"));
  if (!assets.length) throw new Error("Facebook médium nemá veřejnou HTTPS adresu");

  if (assets.length > 1 && assets.every(item => item.resourceType === "image")) {
    const attached: Array<{ media_fbid: string }> = [];
    for (const asset of assets) {
      const uploaded = await graph(`${pageId}/photos`, new URLSearchParams({
        access_token: token,
        url: asset.url,
        published: "false",
      }));
      if (!uploaded.id) throw new Error("Facebook image ID chybí");
      attached.push({ media_fbid: String(uploaded.id) });
    }
    const result = await graph(`${pageId}/feed`, new URLSearchParams({
      access_token: token,
      message: input.caption,
      attached_media: JSON.stringify(attached),
    }));
    return { externalPostId: String(result.id) };
  }

  const first = assets[0];
  if (first.resourceType === "video") {
    const result = await graph(`${pageId}/videos`, new URLSearchParams({
      access_token: token,
      file_url: first.url,
      description: input.caption,
      title: input.title || "Video",
    }));
    return { externalPostId: String(result.id) };
  }

  const result = await graph(`${pageId}/photos`, new URLSearchParams({
    access_token: token,
    url: first.url,
    caption: input.caption,
    published: "true",
  }));
  return { externalPostId: String(result.post_id || result.id) };
}
