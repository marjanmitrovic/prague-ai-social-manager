import { decryptSecret } from "@/lib/crypto";
import type { PublishInput, PublishResult } from "@/lib/social/publish";

const GRAPH = "https://graph.threads.net";

async function call(path: string, params: URLSearchParams) {
  const response = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(body.error?.message || `Threads API (${response.status})`);
  return body;
}

async function waitUntilReady(containerId: string, token: string) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const url = new URL(`${GRAPH}/${containerId}`);
    url.searchParams.set("fields", "status,error_message");
    url.searchParams.set("access_token", token);
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) throw new Error(body.error?.message || `Threads API (${response.status})`);
    if (body.status === "FINISHED") return;
    if (body.status === "ERROR" || body.status === "EXPIRED") throw new Error(body.error_message || `Threads processing ${body.status}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error("Threads processing timeout");
}

export async function publishThreads(input: PublishInput): Promise<PublishResult> {
  const token = decryptSecret(input.account.access_token_encrypted);
  const userId = input.account.external_account_id;
  const first = input.media[0];
  if (!userId) throw new Error("Threads user ID chybí");
  if (input.media.length > 1) throw new Error("Threads carousel vyžaduje samostatnou implementaci child containers");

  const params = new URLSearchParams({ access_token: token, text: input.caption.trim() });
  if (!first) {
    params.set("media_type", "TEXT");
  } else if (first.resourceType === "video") {
    params.set("media_type", "VIDEO");
    params.set("video_url", first.url);
  } else {
    params.set("media_type", "IMAGE");
    params.set("image_url", first.url);
  }

  const container = await call(`${userId}/threads`, params);
  if (!container.id) throw new Error("Threads container ID chybí");
  if (first?.resourceType === "video") await waitUntilReady(String(container.id), token);

  const published = await call(`${userId}/threads_publish`, new URLSearchParams({
    access_token: token,
    creation_id: String(container.id),
  }));
  if (!published.id) throw new Error("Threads nevrátil ID příspěvku");
  return { externalPostId: String(published.id) };
}
