/**
 * Runs an async task so that overlapping requests collapse into one.
 *
 * Admin screens refresh their list from several places at once — a save, a
 * dialog closing, a paginator event, a mind-map re-parent — and each caller
 * firing its own request multiplies traffic for a single answer, with the
 * responses free to land out of order and leave the older one on screen.
 *
 * `trigger()` starts the task if it is idle. Calls made while it is running are
 * collapsed into a single replay that runs once the in-flight task settles, so
 * the result always reflects the most recent request without ever having two
 * in the air.
 */
export class CoalescedTask {
    private _inFlight = false;
    private _queued = false;

    constructor(private readonly _run: () => Promise<void>) {}

    /** True while the task is running — useful for a loading indicator. */
    get isRunning(): boolean {
        return this._inFlight;
    }

    trigger(): void {
        if (this._inFlight) {
            this._queued = true;
            return;
        }
        this._inFlight = true;
        void this._run().finally(() => {
            this._inFlight = false;
            if (this._queued) {
                this._queued = false;
                this.trigger();
            }
        });
    }
}
