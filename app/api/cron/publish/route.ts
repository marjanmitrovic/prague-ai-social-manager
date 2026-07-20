import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { publishInstagram } from "@/lib/social/instagram";

type Asset = {
  url: string;
  resourceType: "image" | "video" | "raw";
};

function media(value: unknown): Asset[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any) => ({
      url: String(item?.url || item?.secure_url || item?.secureUrl || ""),
      resourceType: (item?.resourceType ||
        item?.resource_type ||
        item?.type ||
        "image") as Asset["resourceType"],
    }))
    .filter((item) => item.url);
}

export async function GET(request: Request) {
  // Scheduled publishing is disabled by default so accidental or stale cron
  // requests cannot keep the Neon database awake. Enable it deliberately by
  // setting PUBLISH_CRON_ENABLED=true in Vercel.
  if (process.env.PUBLISH_CRON_ENABLED !== "true") {
    return NextResponse.json({
      ok: true,
      disabled: true,
      message: "Scheduled publishing is disabled",
    });
  }

  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getSql();
  const targets = await sql`
    SELECT
      pt.id target_id,
      pt.platform,
      p.id post_id,
      p.caption,
      p.media_type,
      p.media_urls,
      sa.external_account_id,
      sa.access_token_encrypted
    FROM post_targets pt
    JOIN posts p ON p.id = pt.post_id
    LEFT JOIN social_accounts sa
      ON sa.client_id = p.client_id
      AND sa.platform = pt.platform
    WHERE pt.status = 'scheduled'
      AND p.status = 'scheduled'
      AND p.scheduled_at <= NOW()
    ORDER BY p.scheduled_at
    LIMIT 10
  `;

  const results: any[] = [];

  for (const target of targets) {
    try {
      await sql`
        UPDATE post_targets
        SET status = 'publishing', error_message = NULL
        WHERE id = ${target.target_id}::uuid
      `;

      if (target.platform !== "instagram") {
        throw new Error("TikTok čeká na API audit");
      }

      if (!target.external_account_id || !target.access_token_encrypted) {
        throw new Error("Instagram účet klienta není připojen");
      }

      const published = await publishInstagram({
        account: {
          external_account_id: target.external_account_id,
          access_token_encrypted: target.access_token_encrypted,
        },
        mediaType: target.media_type,
        media: media(target.media_urls),
        caption: target.caption || "",
      });

      await sql`
        UPDATE post_targets
        SET
          status = 'published',
          external_post_id = ${published.externalPostId},
          published_at = NOW(),
          error_message = NULL
        WHERE id = ${target.target_id}::uuid
      `;

      results.push({ targetId: target.target_id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publish error";
      const retryable = /timeout|not available|not ready|processing/i.test(message);

      await sql`
        UPDATE post_targets
        SET
          status = ${retryable ? "scheduled" : "failed"}::post_status,
          error_message = ${message}
        WHERE id = ${target.target_id}::uuid
      `;

      results.push({
        targetId: target.target_id,
        ok: false,
        retryable,
        error: message,
      });
    }

    const statuses = await sql`
      SELECT status
      FROM post_targets
      WHERE post_id = ${target.post_id}::uuid
    `;

    const values = statuses.map((item: any) => item.status);
    const nextStatus = values.every((status: string) => status === "published")
      ? "published"
      : values.some((status: string) => status === "failed")
        ? "failed"
        : "scheduled";

    await sql`
      UPDATE posts
      SET status = ${nextStatus}::post_status, updated_at = NOW()
      WHERE id = ${target.post_id}::uuid
    `;
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}
