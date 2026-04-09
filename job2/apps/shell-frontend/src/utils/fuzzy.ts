export function fuzzyScore(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  for (let i = 0; i < t.length && qi < q.length; i += 1) {
    if (t[i] === q[qi]) {
      score += i > 0 && t[i - 1] === q[qi - 1] ? 2 : 1;
      qi += 1;
    }
  }
  return qi === q.length ? score / Math.max(t.length, 1) : 0;
}

export function fuzzyFilter<T>(items: T[], query: string, selector: (item: T) => string): T[] {
  return items
    .map((item) => ({ item, score: fuzzyScore(query, selector(item)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
