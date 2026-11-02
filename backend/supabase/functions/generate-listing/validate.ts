export type Listing = {
  title: string;
  description: string;
  tags: string[];
  price_low: number | null;
  price_high: number | null;
  currency_symbol: string;
  check_before_posting: string;
};

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null;
};

export function parseModelJson(text: string): unknown {
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}

export function normalizeListing(raw: unknown): Listing | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, 140);
  const description = str(r.description, 4000);
  if (!title || !description) return null;

  const tags = Array.isArray(r.tags)
    ? r.tags.map((t) => str(t, 40)).filter(Boolean).slice(0, 12)
    : [];

  let low = num(r.price_low);
  let high = num(r.price_high);
  if (low !== null && high !== null && low > high) [low, high] = [high, low];

  return {
    title,
    description,
    tags,
    price_low: low,
    price_high: high,
    currency_symbol: str(r.currency_symbol, 3) || "$",
    check_before_posting: str(r.check_before_posting, 600),
  };
}
