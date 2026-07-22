import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql, hasDatabaseConfig } from "@/lib/db";
import { defaultTargetFormat, SOCIAL_PLATFORMS } from "@/lib/social/platforms";

const asset = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
  resourceType: z.enum(["image", "video", "raw"]),
  originalFilename: z.string().optional(),
  bytes: z.number().optional(),
});

const schema = z.object({
  client_id: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  brief: z.string().max(4000).default(""),
  caption: z.string().trim().min(2).max(10000),
  platform_captions: z.record(z.enum(SOCIAL_PLATFORMS), z.string().trim().min(1).max(10000)).optional().default({}),
  media_type: z.enum(["photo", "reel", "carousel", "story"]),
  media_urls: z.array(asset).min(1).max(10),
  scheduled_at: z.string().datetime(),
  status: z.enum(["draft", "scheduled", "pending_approval"]).default("scheduled"),
  platforms: z.array(z.enum(SOCIAL_PLATFORMS)).min(1),
}).superRefine((value, context) => {
  if (value.media_type === "reel" && value.media_urls[0]?.resourceType !== "video") {
    context.addIssue({ code: "custom", path: ["media_type"], message: "Reel vyžaduje video." });
  }
  if (value.media_type === "photo" && value.media_urls[0]?.resourceType !== "image") {
    context.addIssue({ code: "custom", path: ["media_type"], message: "Fotografie vyžaduje obrázek." });
  }
  if (value.media_type === "carousel" && value.media_urls.length < 2) {
    context.addIssue({ code: "custom", path: ["media_urls"], message: "Carousel vyžaduje alespoň dvě média." });
  }
  if (value.platforms.includes("youtube") && !value.media_urls.some(item => item.resourceType === "video")) {
    context.addIssue({ code: "custom", path: ["platforms"], message: "YouTube vyžaduje video." });
  }
});

export async function GET() {
  if (!hasDatabaseConfig()) return NextResponse.json({ data: [], demo: true });
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT p.*, json_build_object('name', c.name) clients
      FROM posts p
      JOIN clients c ON c.id = p.client_id
      ORDER BY p.created_at DESC
    `;
    return NextResponse.json({ data: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const input = schema.parse(await req.json());
    if (!hasDatabaseConfig()) return NextResponse.json({ error: "DATABASE_URL není nastavené." }, { status: 503 });

    const sql = getSql();
    const clients = await sql`SELECT requires_approval FROM clients WHERE id = ${input.client_id}::uuid`;
    if (!clients[0]) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });

    const finalStatus = input.status === "scheduled" && clients[0].requires_approval ? "pending_approval" : input.status;
    const rows = await sql`
      INSERT INTO posts(client_id, title, brief, caption, media_type, media_urls, scheduled_at, status)
      VALUES(
        ${input.client_id}::uuid,
        ${input.title},
        ${input.brief},
        ${input.caption},
        ${input.media_type},
        ${JSON.stringify(input.media_urls)}::jsonb,
        ${input.scheduled_at}::timestamptz,
        ${finalStatus}::post_status
      )
      RETURNING *
    `;
    const post = rows[0];

    for (const platform of input.platforms) {
      const platformCaption = input.platform_captions[platform] || input.caption;
      const targetFormat = defaultTargetFormat(platform, input.media_type);
      try {
        await sql`
          INSERT INTO post_targets(post_id, platform, target_format, platform_caption, status)
          VALUES(
            ${post.id}::uuid,
            ${platform}::platform_name,
            ${targetFormat},
            ${platformCaption},
            ${finalStatus}::post_status
          )
          ON CONFLICT(post_id, platform) DO UPDATE SET
            target_format = EXCLUDED.target_format,
            platform_caption = EXCLUDED.platform_caption,
            status = EXCLUDED.status,
            error_message = NULL
        `;
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!/platform_caption/i.test(message)) throw error;
        await sql`
          INSERT INTO post_targets(post_id, platform, target_format, status)
          VALUES(${post.id}::uuid, ${platform}::platform_name, ${targetFormat}, ${finalStatus}::post_status)
          ON CONFLICT(post_id, platform) DO UPDATE SET
            target_format = EXCLUDED.target_format,
            status = EXCLUDED.status,
            error_message = NULL
        `;
      }
    }

    await sql`
      INSERT INTO audit_log(entity_type, entity_id, action, details)
      VALUES(
        'post',
        ${post.id}::uuid,
        'created',
        ${JSON.stringify({ status: finalStatus, platforms: input.platforms })}::jsonb
      )
    `;

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(issue => issue.message).join(" ") }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Invalid input";
    if (/invalid input value for enum platform_name/i.test(message)) {
      return NextResponse.json({ error: "Nejdříve spusťte migraci migrations/002_multiplatform.sql v Neon databázi." }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
