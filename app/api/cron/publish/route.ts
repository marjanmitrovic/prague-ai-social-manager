import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { ManualPublishingRequiredError, publishToPlatform } from "@/lib/social/publish";
import { isSocialPlatform, platformLabel } from "@/lib/social/platforms";

type Asset = {
  url: string;
  resourceType: "image" | "video" | "raw";
};

function media(value: unknown): Asset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      url: String(item?.url || item?.secure_url || item?.secureUrl || ""),
      resourceType: (item?.resourceType || item?.resource_type || item?.type || "image") as Asset["resourceType"],
    }))
    .filter(item => item.url);
}

export async function GET(request: Request) {
  if (process.env.PUBLISH_CRON_ENABLED !== "true") {
    return NextResponse.json({ ok: true, disabled: true, message: "Scheduled publishing is disabled" });
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
      pt.target_format,
      p.id post_id,
      p.title,
      COALESCE(pt.platform_caption, p.caption) caption,
      p.media_type,
      p.media_urls,
      sa.external_account_id,
      sa.access_token_encrypted
    FROM post_targets pt
    JOIN posts p ON p.id = pt.post_id
    LEFT JOIN social_accounts sa
      ON sa.client_id = p.client_id
      AND sa.platform = pt.platform
      AND sa.connection_status = 'connected'
    WHERE pt.status = 'scheduled'
      AND p.status IN ('scheduled', 'manual_action')
      AND p.scheduled_at <= NOW()
    ORDER BY p.scheduled_at
    LIMIT 20
  `;

  const results: any[] = [];

  for (const target of targets) {
    try {
      if (!isSocialPlatform(String(target.platform))) {
        throw new Error(`Neznámá platforma: ${target.platform}`);
      }

      await sql`
        UPDATE post_targets
        SET status = 'publishing', error_message = NULL
        WHERE id = ${target.target_id}::uuid
      `;

      if (!target.external_account_id || !target.access_token_encrypted) {
        throw new ManualPublishingRequiredError(
          target.platform,
          `${platformLabel(target.platform)} účet klienta není připojen.`
        );
      }

      const published = await publishToPlatform({
        platform: target.platform,
        account: {
          external_account_id: target.external_account_id,
          access_token_encrypted: target.access_token_encrypted,
        },
        mediaType: target.target_format || target.media_type,
        media: media(target.media_urls),
        caption: target.caption || "",
        title: target.title || "",
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
      results.push({ targetId: target.target_id, platform: target.platform, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publish error";
      const manual = error instanceof ManualPublishingRequiredError;
      const retryable = !manual && /timeout|not available|not ready|processing|temporarily/i.test(message);
      const status = manual ? "manual_action" : retryable ? "scheduled" : "failed";

      await sql`
        UPDATE post_targets
        SET status = ${status}::post_status, error_message = ${message}
        WHERE id = ${target.target_id}::uuid
      `;

      results.push({
        targetId: target.target_id,
        platform: target.platform,
        ok: false,
        manual,
        retryable,
        error: message,
      });
    }

    const statuses = await sql`
      SELECT status
      FROM post_targets
      WHERE post_id = ${target.post_id}::uuid
    `;
    const values = statuses.map((item: any) => String(item.status));
    const nextStatus = values.every(status => status === "published")
      ? "published"
      : values.some(status => status === "failed")
        ? "failed"
        : values.some(status => status === "scheduled" || status === "publishing")
          ? "scheduled"
          : values.some(status => status === "manual_action")
            ? "manual_action"
            : "scheduled";

    await sql`
      UPDATE posts
      SET status = ${nextStatus}::post_status, updated_at = NOW()
      WHERE id = ${target.post_id}::uuid
    `;
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
