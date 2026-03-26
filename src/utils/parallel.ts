/**
 * Run async tasks in parallel with a concurrency cap and optional delay between starts.
 * Returns results in the same order as the input items.
 */
export async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = 3,
  delayMs: number = 0
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      const item = items[index];

      // Rate-limit: add delay between task starts
      if (delayMs > 0 && index > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      results[index] = await fn(item, index);
    }
  }

  // Spawn `concurrency` workers
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}
