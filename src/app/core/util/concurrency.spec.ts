import { mapWithLimit, settleWithLimit } from './concurrency';

/** Resolves when told to, so a test can hold calls open and count them. */
function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
} {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('settleWithLimit', () => {
    it('keeps results in the order of the items, not of the answers', async () => {
        const results = await settleWithLimit(
            [30, 10, 20],
            3,
            (ms) =>
                new Promise<number>((resolve) =>
                    setTimeout(() => resolve(ms), ms)
                )
        );

        expect(
            results.map((r) => (r as PromiseFulfilledResult<number>).value)
        ).toEqual([30, 10, 20]);
    });

    /** The point of it: one refusal must not cost the answers that arrived. */
    it('settles the rest when one task rejects', async () => {
        const results = await settleWithLimit([1, 2, 3], 2, (n) =>
            n === 2 ? Promise.reject(new Error('429')) : Promise.resolve(n)
        );

        expect(results.map((r) => r.status)).toEqual([
            'fulfilled',
            'rejected',
            'fulfilled',
        ]);
    });

    it('never has more than `limit` in flight', async () => {
        const gates = [
            deferred<number>(),
            deferred<number>(),
            deferred<number>(),
        ];
        let started = 0;
        let peak = 0;
        let inFlight = 0;

        const run = settleWithLimit([0, 1, 2], 2, (index) => {
            started++;
            inFlight++;
            peak = Math.max(peak, inFlight);
            return gates[index].promise.then((value) => {
                inFlight--;
                return value;
            });
        });

        await Promise.resolve();
        expect(started).toBe(2);

        gates[0].resolve(0);
        await Promise.resolve();
        await Promise.resolve();
        expect(started).toBe(3);

        gates[1].resolve(1);
        gates[2].resolve(2);
        await run;
        expect(peak).toBe(2);
    });

    it('does nothing, successfully, for no items', async () => {
        expect(await settleWithLimit([], 4, () => Promise.resolve(1))).toEqual(
            []
        );
    });
});

describe('mapWithLimit', () => {
    it('stands a fallback in for each rejection', async () => {
        const values = await mapWithLimit(
            ['a', 'b', 'c'],
            2,
            (key) =>
                key === 'b'
                    ? Promise.reject(new Error('nope'))
                    : Promise.resolve([key]),
            [] as string[]
        );

        expect(values).toEqual([['a'], [], ['c']]);
    });
});
