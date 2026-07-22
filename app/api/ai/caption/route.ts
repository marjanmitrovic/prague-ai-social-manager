import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PLATFORM_DEFINITIONS, SOCIAL_PLATFORMS, SocialPlatform } from "@/lib/social/platforms";

const schema = z.object({
  brief: z.string().min(3).max(4000),
  language: z.string().default("cs"),
  tone: z.string().default("friendly gastro"),
  platforms: z.array(z.enum(SOCIAL_PLATFORMS)).min(1).default(["instagram"]),
});

function baseLocalCaption(brief: string) {
  const clean = brief.trim().replace(/\s+/g, " ");
  return `✨ ${clean}\n\nPřijďte si užít skvělou atmosféru, dobré jídlo a příjemné chvíle v Praze.\n\nRezervujte si své místo nebo nás navštivte ještě dnes.\n\n#praha #praguefood #gastro #restaurace #visitprague`;
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function localVariants(brief: string, platforms: SocialPlatform[]) {
  const base = baseLocalCaption(brief);
  return Object.fromEntries(platforms.map(platform => {
    let value = base;
    if (platform === "x") value = `${brief.trim()}\n\n#Prague #Gastro`;
    if (platform === "linkedin") value = `${brief.trim()}\n\nTěšíme se na vaši návštěvu. Sledujte nás pro další novinky z našeho podniku v Praze.`;
    if (platform === "youtube") value = `${brief.trim()}\n\nPřihlaste se k odběru pro další videa a novinky.`;
    if (platform === "threads") value = `${brief.trim()}\n\nCo na to říkáte?`;
    if (platform === "pinterest") value = `${brief.trim()}\n\nInspirace, atmosféra a gastro zážitky z Prahy.`;
    return [platform, truncate(value, PLATFORM_DEFINITIONS[platform].maxCaptionLength)];
  })) as Record<SocialPlatform, string>;
}

function parseJsonObject(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI nevrátilo JSON");
  return JSON.parse(value.slice(start, end + 1)) as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const fallback = localVariants(input.brief, input.platforms);
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({
        caption: fallback[input.platforms[0]],
        variants: fallback,
        mode: "local",
        warning: "OPENAI_API_KEY není nastavený. Byl použit lokální generátor.",
      });
    }

    try {
      const client = new OpenAI({ apiKey });
      const limits = input.platforms.map(platform => `${platform}: max ${PLATFORM_DEFINITIONS[platform].maxCaptionLength} znaků`).join(", ");
      const result = await client.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: "Jsi zkušený social media copywriter. Připrav odlišnou, přirozenou verzi stejného sdělení pro každou vybranou platformu. Nevymýšlej fakta. Zachovej hlavní nabídku a CTA. Pro LinkedIn piš profesionálněji, pro X stručně, pro Instagram a TikTok přirozeněji a s omezeným počtem hashtagů. Vrať pouze platný JSON objekt, kde klíče jsou přesně názvy platforem a hodnoty jsou hotové texty bez markdownu.",
          },
          {
            role: "user",
            content: `Jazyk: ${input.language}\nTón: ${input.tone}\nPlatformy a limity: ${limits}\nBrief: ${input.brief}`,
          },
        ],
      });

      const raw = parseJsonObject(result.output_text || "");
      const variants = { ...fallback } as Record<SocialPlatform, string>;
      for (const platform of input.platforms) {
        const value = raw[platform];
        if (typeof value === "string" && value.trim()) {
          variants[platform] = truncate(value.trim(), PLATFORM_DEFINITIONS[platform].maxCaptionLength);
        }
      }

      return NextResponse.json({ caption: variants[input.platforms[0]], variants, mode: "openai" });
    } catch (error) {
      return NextResponse.json({
        caption: fallback[input.platforms[0]],
        variants: fallback,
        mode: "local",
        warning: error instanceof Error ? `OpenAI není dostupné: ${error.message}` : "OpenAI není dostupné.",
      });
    }
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map(issue => issue.message).join(" ")
      : error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
