import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  brief: z.string().min(3).max(4000),
  language: z.string().default("cs"),
  tone: z.string().default("friendly gastro")
});

function localCaption(brief: string) {
  const clean = brief.trim().replace(/\s+/g, " ");
  return `✨ ${clean}\n\nPřijďte si užít skvělou atmosféru, dobré jídlo a příjemné chvíle v Praze.\n\nRezervujte si své místo nebo nás navštivte ještě dnes.\n\n#praha #praguefood #gastro #restaurace #visitprague`;
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({
        caption: localCaption(input.brief),
        mode: "local",
        warning: "OPENAI_API_KEY není nastavený. Byl použit lokální generátor."
      });
    }

    try {
      const client = new OpenAI({ apiKey });
      const result = await client.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: "Jsi social media copywriter pro gastro podniky. Piš přirozeně česky, bez falešných tvrzení. Vrať hotový text příspěvku, krátké CTA a maximálně 8 relevantních hashtagů."
          },
          {
            role: "user",
            content: `Jazyk: ${input.language}\nTón: ${input.tone}\nBrief: ${input.brief}`
          }
        ]
      });

      return NextResponse.json({ caption: result.output_text, mode: "openai" });
    } catch (error) {
      return NextResponse.json({
        caption: localCaption(input.brief),
        mode: "local",
        warning: error instanceof Error ? `OpenAI není dostupné: ${error.message}` : "OpenAI není dostupné."
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
