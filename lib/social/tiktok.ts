import { decryptSecret } from "@/lib/crypto";
import type { PublishInput, PublishResult } from "@/lib/social/publish";

export async function publishTikTok(input: PublishInput): Promise<PublishResult> {
  const token = decryptSecret(input.account.access_token_encrypted);
  const first = input.media[0];
  if (!first?.url?.startsWith("https://")) throw new Error("TikTok vyžaduje veřejnou HTTPS adresu média");

  const isVideo = first.resourceType === "video";
  const endpoint = isVideo
    ? "https://open.tiktokapis.com/v2/post/publish/video/init/"
    : "https://open.tiktokapis.com/v2/post/publish/content/init/";

  const payload = isVideo
    ? {
        post_info: {
          title: input.caption.slice(0, 2200),
          privacy_level: process.env.TIKTOK_PRIVACY_LEVEL || "SELF_ONLY",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: first.url,
        },
      }
    : {
        post_info: {
          title: input.caption.slice(0, 2200),
          privacy_level: process.env.TIKTOK_PRIVACY_LEVEL || "SELF_ONLY",
          disable_comment: false,
          auto_add_music: true,
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: input.media.filter(item => item.resourceType === "image").map(item => item.url),
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error?.code) {
    throw new Error(body.error?.message || body.error?.code || `TikTok API (${response.status})`);
  }
  const id = body.data?.publish_id;
  if (!id) throw new Error("TikTok nevrátil publish ID");
  return { externalPostId: String(id) };
}
