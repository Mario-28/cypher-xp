import { CHART_COLORS, PURCHASE_CATALOG } from "../constants.js";

/** DD.MM.YYYY session key from a timestamp. */
export function dateKey(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

const INTRUSION_GAIN_TYPES = new Set(["gm-intrusion", "gm-intrusion-transfer-received"]);

/**
 * Aggregates one actor's transaction ledger into chart-ready datasets.
 */
export function summarizeTransactions(transactions) {
  const sessions = new Map();
  const byCategory = new Map();
  const bySpendType = new Map();

  let totalEarned = 0;
  let intrusionEarned = 0;
  let playerIntrusionSpent = 0;
  let totalSpentDevelopment = 0;
  let totalSpentImmediate = 0;
  let totalProgress = 0;

  for (const t of transactions ?? []) {
    const key = dateKey(t.timestamp ?? Date.now());
    const s = sessions.get(key) ?? { date: key, earned: 0, spent: 0, progress: 0, intrusion: 0, immediate: 0, firstTs: t.timestamp };

    const gained = t.xpDelta > 0 ? t.xpDelta : 0;
    const spent = t.xpDelta < 0 ? Math.abs(t.xpDelta) : 0;

    s.earned += gained;
    s.spent += spent;
    totalEarned += gained;

    if (t.progressDelta > 0) {
      s.progress += t.progressDelta;
      totalProgress += t.progressDelta;
    }

    if (INTRUSION_GAIN_TYPES.has(t.type) && gained > 0) {
      s.intrusion += gained;
      intrusionEarned += gained;
    }

    if (t.type === "immediate-spend" && spent > 0) {
      s.immediate += spent;
      totalSpentImmediate += spent;
      const st = t.metadata?.spendType ?? "other";
      bySpendType.set(st, (bySpendType.get(st) ?? 0) + spent);
      if (st === "player-intrusion") playerIntrusionSpent += spent;
    }

    if (t.type === "development-purchase" && spent > 0) {
      totalSpentDevelopment += spent;
      const cat = t.metadata?.category ?? "other";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + spent);
    }

    sessions.set(key, s);
  }

  const sessionList = [...sessions.values()].sort((a, b) => a.firstTs - b.firstTs);

  return {
    hasData: (transactions ?? []).length > 0,
    sessions: sessionList,
    totals: {
      earned: totalEarned,
      intrusionEarned,
      playerIntrusionSpent,
      spentDevelopment: totalSpentDevelopment,
      spentImmediate: totalSpentImmediate,
      progress: totalProgress
    },
    byCategory: [...byCategory.entries()].map(([key, value]) => ({
      key,
      label: PURCHASE_CATALOG[key]?.category ?? key,
      value,
      color: CHART_COLORS[PURCHASE_CATALOG[key]?.category] ?? CHART_COLORS.other
    })),
    bySpendType: [...bySpendType.entries()].map(([key, value]) => ({ key, value }))
  };
}

/**
 * Combines per-actor summaries into one party-wide dataset — all actors on
 * the same charts. perActor entries: { actorId, name, img, xp, tier,
 * progress, threshold, summary }.
 */
export function summarizeParty(perActor) {
  const sessions = new Map();
  const byCategory = new Map();

  const totals = {
    earned: 0,
    intrusionEarned: 0,
    playerIntrusionSpent: 0,
    spentDevelopment: 0,
    spentImmediate: 0,
    progress: 0,
    currentXp: 0
  };

  for (const entry of perActor) {
    const s = entry.summary;
    totals.earned += s.totals.earned;
    totals.intrusionEarned += s.totals.intrusionEarned;
    totals.playerIntrusionSpent += s.totals.playerIntrusionSpent;
    totals.spentDevelopment += s.totals.spentDevelopment;
    totals.spentImmediate += s.totals.spentImmediate;
    totals.progress += s.totals.progress;
    totals.currentXp += entry.xp ?? 0;

    for (const sess of s.sessions) {
      const agg = sessions.get(sess.date) ?? { date: sess.date, earned: 0, spent: 0, progress: 0, intrusion: 0, immediate: 0, firstTs: sess.firstTs };
      agg.earned += sess.earned;
      agg.spent += sess.spent;
      agg.progress += sess.progress;
      agg.intrusion += sess.intrusion;
      agg.immediate += sess.immediate;
      agg.firstTs = Math.min(agg.firstTs, sess.firstTs);
      sessions.set(sess.date, agg);
    }

    for (const c of s.byCategory) {
      const existing = byCategory.get(c.key);
      if (existing) existing.value += c.value;
      else byCategory.set(c.key, { key: c.key, label: c.label, value: c.value, color: c.color });
    }
  }

  return {
    hasData: perActor.some(e => e.summary.hasData),
    sessions: [...sessions.values()].sort((a, b) => a.firstTs - b.firstTs),
    totals,
    byCategory: [...byCategory.values()],
    perActor
  };
}
