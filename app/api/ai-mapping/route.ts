import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const LOAN_FIELDS = [
  { key: "name", label: "שם ההלוואה / מסלול / מספר הלוואה" },
  { key: "originalAmount", label: "סכום מקורי / קרן ראשונית" },
  { key: "currentBalance", label: "יתרה נוכחית / קרן לפירעון" },
  { key: "annualInterestRate", label: "ריבית שנתית ב-% (למשל: 4.5)" },
  { key: "monthlyInterestAmount", label: "סכום ריבית חודשי ב-₪ (לא אחוז — הסכום שמשולם)" },
  { key: "monthlyPayment", label: "תשלום חודשי כולל (קרן + ריבית)" },
  { key: "principalAmount", label: "קרן חודשית (החלק מהתשלום שמקטין את היתרה)" },
  { key: "paymentDate", label: "תאריך תשלום / מועד" },
  { key: "notes", label: "הערות / מסלול ריבית" },
];

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
        await sleep((attempt + 1) * 1500);
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
    return NextResponse.json(
      { mapping: {}, confidence: 0, explanation: "מפתח API חסר — מפה את העמודות ידנית", hasVariableRate: false, isAmortizationTable: false },
      { status: 200 }
    );
  }

  try {
    const { headers, sampleRows } = (await req.json()) as {
      headers: string[];
      sampleRows: string[][];
    };

    const sampleStr = sampleRows
      .slice(0, 5)
      .map((row, i) => `שורה ${i + 1}: ${row.map((v, j) => `${headers[j]}="${v}"`).join(", ")}`)
      .join("\n");

    const rowCount = sampleRows.length;

    const prompt = `אתה מומחה לניתוח קבצי Excel של הלוואות בנקאיות ישראליות.

קיבלתי קובץ עם ${rowCount} שורות נתונים ועמודות אלה:
${headers.map((h, i) => `${i + 1}. "${h}"`).join("\n")}

דוגמאות נתונים (${Math.min(5, rowCount)} שורות):
${sampleStr}

השדות האפשריים לזיהוי:
${LOAN_FIELDS.map((f) => `- ${f.key}: ${f.label}`).join("\n")}

הנחיות חשובות:
1. אם עמודת "ריבית" מכילה סכומים בשקלים (למשל 800, 1200) ולא אחוזים (למשל 4.5, 5.2) — מפה ל-monthlyInterestAmount ולא לannualInterestRate
2. אם הקובץ נראה כטבלת תשלומים (שורה לכל חודש עם תאריך + ריבית + קרן + יתרה) — הוא לוח סילוקין
3. זהה אם הריבית משתנה: השווה בין ערכי הריבית בשורות — אם הם שונים משמעותית בעקביות, זו ריבית משתנה
4. ריבית יורדת בהדרגה עם הזמן (בגלל ירידת יתרה) היא ריבית קבועה — לא משתנה!
5. ריבית משתנה היא כאשר שיעור הריבית (%) עצמו משתנה, לא רק הסכום

החזר JSON בלבד (ללא markdown):
{
  "mapping": {
    "name": "שם עמודה מקורית או null",
    "originalAmount": "שם עמודה מקורית או null",
    "currentBalance": "שם עמודה מקורית או null",
    "annualInterestRate": "שם עמודה מקורית או null",
    "monthlyInterestAmount": "שם עמודה מקורית או null",
    "monthlyPayment": "שם עמודה מקורית או null",
    "principalAmount": "שם עמודה מקורית או null",
    "paymentDate": "שם עמודה מקורית או null",
    "notes": "שם עמודה מקורית או null"
  },
  "confidence": 0.9,
  "explanation": "הסבר קצר בעברית על המיפוי ועל סוג הנתונים שזוהה",
  "isAmortizationTable": false,
  "hasVariableRate": false,
  "variableRateNote": "הסבר על סוג הריבית שזוהה (אם רלוונטי)"
}`;

    const message = await callWithRetry(() =>
      client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      })
    );

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleaned);

    const cleanMapping: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(result.mapping ?? {})) {
      cleanMapping[k] = v && headers.includes(v as string) ? (v as string) : null;
    }

    return NextResponse.json({
      mapping: cleanMapping,
      confidence: result.confidence ?? 0.5,
      explanation: result.explanation ?? "זיהוי אוטומטי",
      isAmortizationTable: result.isAmortizationTable ?? false,
      hasVariableRate: result.hasVariableRate ?? false,
      variableRateNote: result.variableRateNote ?? "",
    });
  } catch (err) {
    const e = err as { status?: number; error?: { type?: string } };
    if (e.status === 529) {
      return NextResponse.json(
        { mapping: {}, confidence: 0, explanation: "שרת ה-AI עמוס כרגע — מפה ידנית", isAmortizationTable: false, hasVariableRate: false },
        { status: 200 }
      );
    }
    console.error("ai-mapping error:", err);
    return NextResponse.json(
      { mapping: {}, confidence: 0, explanation: "שגיאה בזיהוי AI — מפה ידנית", isAmortizationTable: false, hasVariableRate: false },
      { status: 200 }
    );
  }
}
