import { decryptSecret } from "@/lib/crypto";
import type { PublishInput, PublishResult } from "@/lib/social/publish";

export async function publishYouTube(input: PublishInput): Promise<PublishResult> {
  const token = decryptSecret(input.account.access_token_encrypted);
  const video = input.media.find(item => item.resourceType === "video");
  if (!video?.url?.startsWith("https://")) throw new Error("YouTube vyžaduje veřejné HTTPS video");

  const mediaResponse = await fetch(video.url, { cache: "no-store" });
  if (!mediaResponse.ok) throw new Error(`Video nelze stáhnout (${mediaResponse.status})`);
  const declaredSize = Number(mediaResponse.headers.get("content-length") || 0);
  const maxBytes = Number(process.env.YOUTUBE_MAX_UPLOAD_BYTES || 100_000_000);
  if (declaredSize && declaredSize > maxBytes) throw new Error("Video je příliš velké pro serverless upload");

  const bytes = new Uint8Array(await mediaResponse.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("Video je příliš velké pro serverless upload");
  const mime = mediaResponse.headers.get("content-type") || "video/mp4";
  const boundary = `social-manager-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    snippet: {
      title: (input.title || "Social media video").slice(0, 100),
      description: input.caption.slice(0, 5000),
      categoryId: process.env.YOUTUBE_CATEGORY_ID || "22",
    },
    status: {
      privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS || "private",
      selfDeclaredMadeForKids: false,
    },
  });

  const prefix = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`
  );
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
  const body = new Blob([prefix, bytes, suffix], { type: `multipart/related; boundary=${boundary}` });

  const response = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
      cache: "no-store",
    }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) throw new Error(result.error?.message || `YouTube API (${response.status})`);
  if (!result.id) throw new Error("YouTube nevrátil ID videa");
  return { externalPostId: String(result.id) };
}
