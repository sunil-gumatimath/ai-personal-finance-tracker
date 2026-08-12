/**
 * Pure domain logic for the AI insights feature — no I/O, fully unit-testable.
 * The route layer fetches data, formats currency, and persists results.
 */

type InsightType = "anomaly" | "coaching" | "kudo";

export interface DetectedInsight {
  type: InsightType;
  title: string;
  description: string;
  category?: string;
  amount?: number;
  date?: string;
}

export interface AnomalyCandidate {
  type: "expense";
  amount: number;
  description: string | null;
  date: string;
  categoryName: string | null;
}

/**
 * Minimum expense amount (in the user's currency) before an anomaly can be
 * flagged. A flat "$50" threshold is meaningless for JPY (≈$0.33) or INR, so
 * the cutoff scales with the currency.
 */
const ANOMALY_THRESHOLDS: Record<string, number> = {
  USD: 50,
  EUR: 50,
  GBP: 40,
  INR: 500,
  JPY: 5000,
  KRW: 50000,
  CAD: 60,
  AUD: 60,
  CNY: 300,
};

const DEFAULT_ANOMALY_THRESHOLD = 50;

/** A transaction is an anomaly when it exceeds the category average by this factor. */
const ANOMALY_MULTIPLIER = 1.8;
/** Inspect the N most recent transactions per category (input must be newest-first). */
export const ANOMALY_LOOKBACK = 10;
/** Never emit more than this many anomaly insights per generation. */
export const MAX_ANOMALIES = 5;
/** Never accept more than this many AI-generated insights per response. */
export const MAX_AI_INSIGHTS = 5;

export function getAnomalyThreshold(currency: string): number {
  return ANOMALY_THRESHOLDS[currency] ?? DEFAULT_ANOMALY_THRESHOLD;
}

/**
 * Rule-based anomaly detection.
 *
 * `transactions` must be sorted newest-first (as the route query returns them).
 * The currency formatter is injected so this stays free of Intl/locale logic.
 */
export function detectAnomalies(
  transactions: AnomalyCandidate[],
  currency: string,
  formatCurrency: (amount: number) => string,
): DetectedInsight[] {
  const threshold = getAnomalyThreshold(currency);

  const byCategory = new Map<
    string,
    { total: number; count: number; recent: AnomalyCandidate[] }
  >();

  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const name = t.categoryName || "Uncategorized";
    const stats = byCategory.get(name) ?? { total: 0, count: 0, recent: [] };
    stats.total += t.amount;
    stats.count += 1;
    if (stats.recent.length < ANOMALY_LOOKBACK) stats.recent.push(t);
    byCategory.set(name, stats);
  }

  const anomalies: DetectedInsight[] = [];
  for (const [categoryName, stats] of byCategory) {
    const average = stats.total / stats.count;
    for (const t of stats.recent) {
      if (t.amount > average * ANOMALY_MULTIPLIER && t.amount > threshold) {
        anomalies.push({
          type: "anomaly",
          title: "Unusual Spending",
          description: `You spent ${formatCurrency(t.amount)} on ${t.description || categoryName}, which is higher than your typical ${formatCurrency(average)} average.`,
          category: categoryName,
          amount: t.amount,
          date: t.date,
        });
        if (anomalies.length >= MAX_ANOMALIES) return anomalies;
      }
    }
  }

  return anomalies;
}

/**
 * Parse and strictly validate the JSON blob returned by the LLM for insights.
 * Never trusts the model: only well-formed entries with an allowed type and
 * non-empty string fields survive; output is capped and length-limited.
 */
export function parseAiInsightsJson(raw: string): DetectedInsight[] {
  if (!raw || typeof raw !== "string") return [];

  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  if (!cleaned) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { insights?: unknown } | null)?.insights;
  if (!Array.isArray(list)) return [];

  const insights: DetectedInsight[] = [];
  for (const item of list) {
    if (insights.length >= MAX_AI_INSIGHTS) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const record = item as Record<string, unknown>;
    let type: InsightType | null = null;
    if (record.type === "kudo") type = "kudo";
    else if (record.type === "coaching") type = "coaching";
    // Anything else from the model (e.g. "anomaly") is dropped.
    if (!type) continue;

    if (typeof record.title !== "string" || !record.title.trim()) continue;
    if (typeof record.description !== "string" || !record.description.trim())
      continue;

    insights.push({
      type,
      title: record.title.trim().slice(0, 200),
      description: record.description.trim().slice(0, 1000),
    });
  }

  return insights;
}
