import { Injectable, signal } from '@angular/core';

/**
 * Which job the console is showing right now.
 *
 * One `admin` account currently covers both the Administrator and the
 * Operations Manager duties (`specs/product/ROLE_MATRIX.md`), so the console
 * splits by **task**, not by role: the switch narrows the nav to one job at a
 * time instead of showing every section at once. When a real
 * `operations_manager` account exists, that role simply locks to `operations`.
 */
export type ConsoleMode = 'operations' | 'administration';

const STORAGE_KEY = 'freshflow.consoleMode';
const DEFAULT_MODE: ConsoleMode = 'operations';

/** Restores the last mode; falls back to operations (the daily job). */
function restore(): ConsoleMode {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'administration' || stored === 'operations'
            ? stored
            : DEFAULT_MODE;
    } catch {
        // Private mode / storage disabled — the switch still works in-session.
        return DEFAULT_MODE;
    }
}

@Injectable({ providedIn: 'root' })
export class ConsoleModeService {
    private _mode = signal<ConsoleMode>(restore());

    /** The active console mode. */
    readonly mode = this._mode.asReadonly();

    /** Switch the console to `mode` and remember it across sessions. */
    set(mode: ConsoleMode): void {
        this._mode.set(mode);
        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch {
            // Ignore — persistence is a convenience, not a requirement.
        }
    }
}
