export function getFirstNItems<T>(a: T[], n: number): T[] {
  return a.slice(0, n);
}

/**
 * Returns a new array with duplicates removed.
 * Uses Set for primitives, JSON.stringify for objects.
 */
export function getUniqueValues<T>(arr: T[]): T[] {
  if (arr.length === 0) return [];
  // Fast path for primitives (strings, numbers, booleans)
  if (typeof arr[0] !== "object" || arr[0] === null) {
    return [...new Set(arr)];
  }
  // Object path: use JSON serialization for dedup
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of arr) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export function intersection<T>(a: T[], b: T[]): T[] {
  return a.filter((x) => b.includes(x));
}
