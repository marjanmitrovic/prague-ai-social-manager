import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const createSchema = z.object({
  brief: z.string().min(3).max(4000),
  kind: z.enum(["image", "video"]),
  language: z.string().default("cs")
});

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} není nastavený`);
  return value;
}

async function openAIError(response: Response) {
  const body = await response.json().catch(() => ({}));
  return body?.error?.message || `OpenAI API (${response.status})`;
}

async function uploadCloudinary(file: string | Blob, resourceType: "image" | "video", filename?: string) {
  const cloud = required("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
  const preset = required("NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET");
  const form = new FormData();
  if (file instanceof Blob) form.append("file", file, filename || `ai-${Date.now()}`);
  else form.append("file", file);
  form.append("upload_preset", preset);
  form.append("folder", "prague-ai-social-manager/ai");
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/upload`, {
    method: "POST",
    body: form
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `Cloudinary upload (${response.status})`);
  return {
    url: String(body.secure_url),
    publicId: String(body.public_id),
    resourceType,
    uploadStatus: "uploaded" as const,
    originalFilename: filename || `ai-${resourceType}-${Date.now()}.${resourceType === "video" ? "mp4" : "png"}`,
    bytes: Number(body.bytes || 0)
  };
}

function imagePrompt(brief: string, language: string) {
  return `Create a premium vertical social media image for Instagram based on this brief: ${brief}\nLanguage context: ${language}. Portrait composition, 4:5 ratio, polished commercial photography, natural lighting, strong focal point, clean background, no logos, no watermarks, no embedded text, no copyrighted characters, no real public figures.`;
}

function videoPrompt(brief: string, language: string) {
  return `Create an 8-second vertical 9:16 social media Reel based on this brief: ${brief}\nLanguage context: ${language}. One coherent cinematic shot, clear subject, subtle camera movement, realistic lighting, visually engaging first second, no logos, no watermarks, no embedded text, no copyrighted characters, no real people or public figures, suitable for all audiences.`;
}

export async function POST(request: Request) {
  try {
    const input = createSchema.parse(await request.json());
    const apiKey = required("OPENAI_API_KEY");

    if (input.kind === "image") {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1-mini",
          prompt: imagePrompt(input.brief, input.language),
          size: "1024x1536",
          quality: "low",
          output_format: "png"
        })
      });
      if (!response.ok) throw new Error(await openAIError(response));
      const body = await response.json();
      const base64 = body?.data?.[0]?.b64_json;
      if (!base64) throw new Error("OpenAI nevrátil obrázek");
      const asset = await uploadCloudinary(`data:image/png;base64,${base64}`, "image", `ai-image-${Date.now()}.png`);
      return NextResponse.json({ ok: true, kind: "image", asset });
    }

    const form = new FormData();
    form.append("model", process.env.OPENAI_VIDEO_MODEL?.trim() || "sora-2");
    form.append("prompt", videoPrompt(input.brief, input.language));
    form.append("size", "720x1280");
    form.append("seconds", "8");
    const response = await fetch("https://api.openai.com/v1/videos", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });
    if (!response.ok) throw new Error(await openAIError(response));
    const job = await response.json();
    return NextResponse.json({
      ok: true,
      kind: "video",
      jobId: job.id,
      status: job.status,
      progress: job.progress || 0
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  try {
    const apiKey = required("OPENAI_API_KEY");
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id || !/^video_[A-Za-z0-9_-]+$/.test(id)) throw new Error("Neplatné video ID");

    const statusResponse = await fetch(`https://api.openai.com/v1/videos/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store"
    });
    if (!statusResponse.ok) throw new Error(await openAIError(statusResponse));
    const job = await statusResponse.json();

    if (job.status === "failed") throw new Error(job?.error?.message || "Generování videa selhalo");
    if (job.status !== "completed") {
      return NextResponse.json({ ok: true, status: job.status, progress: job.progress || 0 });
    }

    const contentResponse = await fetch(`https://api.openai.com/v1/videos/${encodeURIComponent(id)}/content`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store"
    });
    if (!contentResponse.ok) throw new Error(`Video download (${contentResponse.status})`);
    const videoBlob = new Blob([await contentResponse.arrayBuffer()], { type: "video/mp4" });
    const asset = await uploadCloudinary(videoBlob, "video", `${id}.mp4`);
    return NextResponse.json({ ok: true, status: "completed", progress: 100, asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI video status failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
