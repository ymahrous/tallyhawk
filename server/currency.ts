import "server-only";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

const EXCHANGE_RATE_BASE_URL = "https://v6.exchangerate-api.com/v6";

/** ISO 4217 codes accepted as a base currency — the same list the account selector offers. */
export const VALID_CURRENCIES: ReadonlySet<string> = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));

export interface Conversion {
  amount: number;
  /**
   * null when no real conversion happened (no EXCHANGE_RATE_API_KEY, or the API failed) — as opposed
   * to same-currency, where 1 is a genuine rate. Callers MUST treat null as "not converted" and never
   * persist the returned amount as if it were in the target currency: a fabricated 1.0 rate would be
   * indistinguishable from a real 1:1 conversion (see AGENTS.md, Multi-currency).
   */
  rate: number | null;
}

export async function convertCurrency(amount: number, from: string, to: string): Promise<Conversion> {
  if (from === to) return { amount, rate: 1 };

  const key = process.env.EXCHANGE_RATE_API_KEY;
  if (!key) {
    console.warn("No EXCHANGE_RATE_API_KEY set, cannot convert");
    return { amount, rate: null };
  }

  try {
    const url = `${EXCHANGE_RATE_BASE_URL}/${key}/pair/${encodeURIComponent(from)}/${encodeURIComponent(to)}/${amount}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      result?: string;
      conversion_result?: number;
      conversion_rate?: number;
      "error-type"?: string;
    };
    if (data.result === "success" && typeof data.conversion_rate === "number") {
      return { amount: Number(data.conversion_result ?? amount), rate: Number(data.conversion_rate) };
    }
    console.warn(`Exchange rate API error: ${data["error-type"] ?? "unknown"}`);
    return { amount, rate: null };
  } catch (error) {
    console.warn(`Currency conversion failed: ${String(error)}`);
    return { amount, rate: null };
  }
}

export function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
