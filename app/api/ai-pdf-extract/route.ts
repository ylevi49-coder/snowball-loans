import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

function makeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  if (apiKey) return new Anthropic({ apiKey });
  if (authToken) return new Anthropic({ authToken });
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 529 && attempt < maxRetries - 1) {
        await sleep((attempt + 1) * 2000);
        continue;
      }
      throw err;
    }
  }
  throw new Error("מקסימום ניסיונות חוזרים");
}

export async function POST(req: NextRequest) {
  const client = makeClient();
  if (!client) {
    return NextResponse.json({ error: "NO_API_KEY" }, { status: 200 });
  }

  try {
    const { data, mediaType } = (await req.json()) as {
      data: string;
      mediaType: string;
    };

    type AllowedImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const ALLOWED_IMAGE_TYPES: AllowedImageType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    let contentBlock: Anthropic.MessageParam["content"][number];
    if (mediaType === "application/pdf") {
      contentBlock = {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
      } as Anthropic.DocumentBlockParam;
    } else {
      const imgType = ALLOWED_IMAGE_TYPES.includes(mediaType as AllowedImageType)
        ? (mediaType as AllowedImageType)
        : "image/png";
      contentBlock = {
        type: "image",
        source: { type: "base64", media_type: imgType, data },
      } as Anthropic.ImageBlockParam;
    }

    const message = await callWithRetry(() =>
      client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              contentBlock,
              {
                type: "text",
                text: `נתח את המסמך הזה ומצא את פרטי ההלוואות.
החזר JSON בלבד:
{
  "loans": [
    {
      "name": "שם ההלוואה",
      "originalAmount": 0,
      "currentBalance": 0,
      "annualInterestRate": 0,
      "monthlyPayment": 0,
      "notes": ""
    }
  ],
  "confidence": 0.9,
  "summary": "תיאור קצר של מה שנמצא"
}`,
              },
            ],
          },
        ],
      })
    );

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleaned);

    return NextResponse.json({
      loans: result.loans ?? [],
      confidence: result.confidence ?? 0.8,
      summary: result.summary ?? "נתוני הלוואה חולצו",
    });
  } catch (err) {
    const e = err as { status?: number; error?: { type?: string } };
    if (e.status === 401 || e.error?.type === "authentication_error") {
      return NextResponse.json({ error: "NO_API_KEY" }, { status: 200 });
    }
    if (e.status === 529) {
      return NextResponse.json({ error: "OVERLOADED" }, { status: 200 });
    }
    console.error("ai-pdf-extract error:", err);
    return NextResponse.json({ error: "שגיאה בניתוח המסמך" }, { status: 500 });
  }
}
