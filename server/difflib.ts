// A faithful port of the parts of Python's difflib used for vendor matching
// (SequenceMatcher.ratio / quick ratios and get_close_matches), so vendors match exactly as they
// did when the backend ran on Python.

class SequenceMatcher {
  private b2j = new Map<string, number[]>();
  // Arrays of code points, so astral characters count once — as they do in Python strings.
  private a: string[];
  private b: string[];

  constructor(a: string, b: string) {
    this.a = Array.from(a);
    this.b = Array.from(b);
    this.chainB();
  }

  private chainB() {
    const b = this.b;
    for (let i = 0; i < b.length; i++) {
      const list = this.b2j.get(b[i]);
      if (list) list.push(i);
      else this.b2j.set(b[i], [i]);
    }
    // autojunk: in sequences of 200+ items, items making up more than 1% are treated as popular.
    const n = b.length;
    if (n >= 200) {
      const ntest = Math.floor(n / 100) + 1;
      for (const [elt, idxs] of [...this.b2j]) if (idxs.length > ntest) this.b2j.delete(elt);
    }
  }

  private findLongestMatch(alo: number, ahi: number, blo: number, bhi: number): [number, number, number] {
    const { a, b, b2j } = this;
    let besti = alo;
    let bestj = blo;
    let bestsize = 0;
    let j2len = new Map<number, number>();
    for (let i = alo; i < ahi; i++) {
      const newj2len = new Map<number, number>();
      for (const j of b2j.get(a[i]) ?? []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        newj2len.set(j, k);
        if (k > bestsize) {
          besti = i - k + 1;
          bestj = j - k + 1;
          bestsize = k;
        }
      }
      j2len = newj2len;
    }
    // No junk set is used, so (as in CPython) matches extend over equal neighbours — which only
    // matters when autojunk removed popular elements from b2j.
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
      besti--;
      bestj--;
      bestsize++;
    }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) {
      bestsize++;
    }
    return [besti, bestj, bestsize];
  }

  private matchingCharacters(): number {
    const queue: [number, number, number, number][] = [[0, this.a.length, 0, this.b.length]];
    let matches = 0;
    while (queue.length) {
      const [alo, ahi, blo, bhi] = queue.pop()!;
      const [i, j, k] = this.findLongestMatch(alo, ahi, blo, bhi);
      if (k) {
        matches += k;
        if (alo < i && blo < j) queue.push([alo, i, blo, j]);
        if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
      }
    }
    return matches;
  }

  private static calc(matches: number, length: number): number {
    return length ? (2 * matches) / length : 1;
  }

  ratio(): number {
    return SequenceMatcher.calc(this.matchingCharacters(), this.a.length + this.b.length);
  }

  quickRatio(): number {
    const avail = new Map<string, number>();
    for (const ch of this.b) avail.set(ch, (avail.get(ch) ?? 0) + 1);
    let matches = 0;
    for (const ch of this.a) {
      const n = avail.get(ch) ?? 0;
      avail.set(ch, n - 1);
      if (n > 0) matches++;
    }
    return SequenceMatcher.calc(matches, this.a.length + this.b.length);
  }

  realQuickRatio(): number {
    const la = this.a.length;
    const lb = this.b.length;
    return SequenceMatcher.calc(Math.min(la, lb), la + lb);
  }
}

export function similarity(a: string, b: string): number {
  return new SequenceMatcher(a, b).ratio();
}

/** Python's difflib.get_close_matches(word, possibilities, n, cutoff). */
export function getCloseMatches(word: string, possibilities: string[], n = 3, cutoff = 0.6): string[] {
  const scored: [number, string][] = [];
  for (const x of possibilities) {
    const s = new SequenceMatcher(x, word);
    if (s.realQuickRatio() >= cutoff && s.quickRatio() >= cutoff && s.ratio() >= cutoff) scored.push([s.ratio(), x]);
  }
  // heapq.nlargest on (score, x) tuples: highest score first, ties broken by the larger string.
  scored.sort((p, q) => q[0] - p[0] || (q[1] > p[1] ? 1 : q[1] < p[1] ? -1 : 0));
  return scored.slice(0, n).map(([, x]) => x);
}
