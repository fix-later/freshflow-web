import { CoalescedTask } from './coalesced-task';

/** A promise whose settlement the test controls. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    return { promise, resolve };
}

describe('CoalescedTask', () => {
    it('runs immediately when idle', () => {
        let runs = 0;
        const task = new CoalescedTask(async () => {
            runs++;
        });

        task.trigger();
        expect(runs).toBe(1);
    });

    it('collapses calls made while running into a single replay', async () => {
        let runs = 0;
        const gate = deferred();
        const task = new CoalescedTask(() => {
            runs++;
            return runs === 1 ? gate.promise : Promise.resolve();
        });

        task.trigger();
        expect(runs).toBe(1);

        // Three more asks while the first is still in flight.
        task.trigger();
        task.trigger();
        task.trigger();
        expect(runs).toBe(1);

        gate.resolve();
        await gate.promise;
        await Promise.resolve();

        // Exactly one replay, not three.
        expect(runs).toBe(2);
    });

    it('replays after a failure so an error does not wedge the task', async () => {
        let runs = 0;
        const gate = deferred();
        const task = new CoalescedTask(() => {
            runs++;
            return runs === 1
                ? gate.promise.then(() => Promise.reject(new Error('boom')))
                : Promise.resolve();
        });

        task.trigger();
        task.trigger();
        gate.resolve();
        await gate.promise;
        await Promise.resolve();
        await Promise.resolve();

        expect(runs).toBe(2);
    });

    it('reports whether it is running', async () => {
        const gate = deferred();
        const task = new CoalescedTask(() => gate.promise);

        expect(task.isRunning).toBe(false);
        task.trigger();
        expect(task.isRunning).toBe(true);

        gate.resolve();
        await gate.promise;
        await Promise.resolve();
        expect(task.isRunning).toBe(false);
    });

    it('is reusable once settled', async () => {
        let runs = 0;
        const task = new CoalescedTask(async () => {
            runs++;
        });

        task.trigger();
        await Promise.resolve();
        task.trigger();
        expect(runs).toBe(2);
    });
});
