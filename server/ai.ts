import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { ExtractedData } from "./db/schema";

export const AI_MODEL = "gemini-2.5-flash";
const CONFIDENCE = 0.98;

const PROMPT = `
Analyze this document and extract the following information as a JSON object:
{
"vendor": "The name of the vendor/company issuing the document",
"total_amount": "The final total amount due, as a string (e.g., '$1,250.00'), always including currency symbol (e.g., '$', '€', '£')",
"currency": "The ISO 4217 currency code (e.g., 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'). Infer from symbol or context. Default to 'USD' if unclear.",
"date": "The date of purchase/invoice in YYYY-MM-DD format",
"category": "Classify the spend into EXACTLY ONE of these categories: Travel, Meals, Software, Office Supplies, Equipment, Marketing, Utilities, Rent, Insurance, Professional Services, or Other"
}

Return ONLY the valid JSON object.
`;

let client: GoogleGenAI | undefined;
function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/** Sniffs the file type from magic bytes; Gemini reads PDFs natively, so no rasterising is needed. */
export function detectMimeType(bytes: Uint8Array): string {
  const head = Array.from(bytes.subarray(0, 4));
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "application/pdf";
  if (head[0] === 0xff && head[1] === 0xd8) return "image/jpeg";
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png";
  return "image/png";
}

/** Strips a ```json fence if the model added one, then parses. */
export function parseModelJson(text: string): ExtractedData {
  let body = text;
  if (body.includes("```json")) body = body.split("```json")[1].split("```")[0];
  else if (body.includes("```")) body = body.split("```")[1].split("```")[0];
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Model did not return a JSON object");
  return parsed as ExtractedData;
}

export interface AiResult {
  data: ExtractedData;
  source: string;
  confidence: number;
}

/** Downloads the stored file and extracts vendor/amount/currency/date/category with Gemini. */
export async function runAiExtraction(fileUrl: string): Promise<AiResult> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Could not download document (HTTP ${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  const response = await gemini().models.generateContent({
    model: AI_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: PROMPT }, { inlineData: { mimeType: detectMimeType(bytes), data: Buffer.from(bytes).toString("base64") } }],
      },
    ],
    config: { responseMimeType: "application/json" },
  });

  const text = response.text;
  if (!text) throw new Error("Extraction failed: empty model response");
  return { data: parseModelJson(text), source: `google_${AI_MODEL}`, confidence: CONFIDENCE };
}
