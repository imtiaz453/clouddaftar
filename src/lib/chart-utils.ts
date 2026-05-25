/**
 * Fill missing calendar days (UTC) so charts show a continuous timeline.
 */
export function fillDailySalesGaps(
  points: { date: string; amount: number }[],
  rangeStart: Date,
  rangeEnd: Date,
): { date: string; amount: number }[] {
  const byDay = new Map<string, number>();
  for (const p of points) {
    const key = new Date(p.date).toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + p.amount);
  }

  const start = Date.UTC(
    rangeStart.getUTCFullYear(),
    rangeStart.getUTCMonth(),
    rangeStart.getUTCDate(),
  );
  const end = Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), rangeEnd.getUTCDate());

  const out: { date: string; amount: number }[] = [];
  for (let t = start; t <= end; t += 86_400_000) {
    const key = new Date(t).toISOString().slice(0, 10);
    out.push({
      date: `${key}T12:00:00.000Z`,
      amount: byDay.get(key) ?? 0,
    });
  }
  return out;
}
