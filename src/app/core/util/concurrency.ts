/**
 * Runs `task` over `items` with at most `limit` in flight, settling every one
 * and keeping the results in the order the items came in.
 *
 * Two things this is for, and both matter on the admin screens:
 *
 * **It does not fail fast.** `Promise.all` over a fan-out rejects as soon as
 * one call does, and a caller that then falls back to "empty" throws away the
 * answers that did arrive. One agent's unreadable assignment list should cost
 * that agent's row, not the whole screen.
 *
 * **It does not fire everything at once.** Several of these fan-outs are one
 * request per row (there is no batch endpoint), and a wide burst is what trips
 * a rate limiter into the very failure above.
 */
export async function settleWithLimit<T, R>(
    items: readonly T[],
    limit: number,
    task: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = [];
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < items.length) {
            const index = next++;
            try {
                results[index] = {
                    status: 'fulfilled',
                    value: await task(items[index]),
                };
            } catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, () => worker())
    );
    return results;
}

/**
 * {@link settleWithLimit}, with each rejection replaced by `fallback`. For the
 * readers that have something sensible to show for a row they could not read —
 * an empty assignment list, say — and nothing to gain from the reason.
 */
export async function mapWithLimit<T, R>(
    items: readonly T[],
    limit: number,
    task: (item: T) => Promise<R>,
    fallback: R
): Promise<R[]> {
    const settled = await settleWithLimit(items, limit, task);
    return settled.map((result) =>
        result.status === 'fulfilled' ? result.value : fallback
    );
}
