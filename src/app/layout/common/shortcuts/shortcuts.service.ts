import { Injectable } from '@angular/core';
import { Shortcut } from 'app/layout/common/shortcuts/shortcuts.types';
import { Observable, of, ReplaySubject, take } from 'rxjs';

const STORAGE_KEY = 'freshflow.shortcuts';

/**
 * Seed set for the admin console — the destinations an operator returns to
 * every day, in the order of the operational hand-off chain (see
 * `specs/ux/NAVIGATION.md` § Grouping rule).
 */
const DEFAULT_SHORTCUTS: Shortcut[] = [
    {
        id: 'order-groups',
        label: 'Phiên thu mua',
        description: 'Lập phiên theo ngày giao',
        icon: 'heroicons_outline:rectangle-group',
        link: '/admin/order-groups',
        useRouter: true,
    },
    {
        id: 'orders',
        label: 'Đơn hàng',
        description: 'Tất cả đơn của nhà hàng',
        icon: 'heroicons_outline:clipboard-document-list',
        link: '/admin/orders',
        useRouter: true,
    },
    {
        id: 'routes',
        label: 'Cuốc giao hàng',
        description: 'Xe, tuyến và tài xế',
        icon: 'heroicons_outline:truck',
        link: '/admin/routes',
        useRouter: true,
    },
    {
        id: 'restaurants',
        label: 'Nhà hàng',
        description: 'Duyệt hồ sơ và mã số thuế',
        icon: 'heroicons_outline:building-office-2',
        link: '/admin/users?role=restaurant',
        useRouter: true,
    },
    {
        id: 'invoices',
        label: 'Hóa đơn',
        description: 'Công nợ và thanh toán',
        icon: 'heroicons_outline:banknotes',
        link: '/admin/invoices',
        useRouter: true,
    },
    {
        id: 'audit-logs',
        label: 'Nhật ký',
        description: 'Lịch sử thao tác hệ thống',
        icon: 'heroicons_outline:document-text',
        link: '/admin/audit-logs',
        useRouter: true,
    },
];

/**
 * Shortcuts are a **per-browser preference**, not server state: the backend has
 * no shortcuts endpoint, and inventing one would mean inventing an API. They
 * persist to `localStorage`, seeded from `DEFAULT_SHORTCUTS` on first run.
 *
 * The public surface stays Observable-based so `ShortcutsComponent` (stock Fuse)
 * needs no changes — and so swapping in a real endpoint later touches only this
 * file.
 */
@Injectable({ providedIn: 'root' })
export class ShortcutsService {
    private _shortcuts: ReplaySubject<Shortcut[]> = new ReplaySubject<
        Shortcut[]
    >(1);

    constructor() {
        this._shortcuts.next(this._read());
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    get shortcuts$(): Observable<Shortcut[]> {
        return this._shortcuts.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Re-emit the stored shortcuts. Kept for API compatibility — the constructor
     * already seeds the stream, so callers no longer have to resolve this before
     * rendering.
     */
    getAll(): Observable<Shortcut[]> {
        const shortcuts = this._read();
        this._shortcuts.next(shortcuts);
        return of(shortcuts);
    }

    create(shortcut: Shortcut): Observable<Shortcut> {
        const created: Shortcut = { ...shortcut, id: this._newId() };
        this._mutate((shortcuts) => [...shortcuts, created]);
        return of(created);
    }

    update(id: string, shortcut: Shortcut): Observable<Shortcut> {
        const updated: Shortcut = { ...shortcut, id };
        this._mutate((shortcuts) =>
            shortcuts.map((item) => (item.id === id ? updated : item))
        );
        return of(updated);
    }

    delete(id: string): Observable<boolean> {
        this._mutate((shortcuts) => shortcuts.filter((item) => item.id !== id));
        return of(true);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /** Apply `change` to the current list, then persist and re-emit. */
    private _mutate(change: (shortcuts: Shortcut[]) => Shortcut[]): void {
        this.shortcuts$.pipe(take(1)).subscribe((shortcuts) => {
            const next = change(shortcuts);
            this._write(next);
            this._shortcuts.next(next);
        });
    }

    private _read(): Shortcut[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                return [...DEFAULT_SHORTCUTS];
            }
            const parsed = JSON.parse(stored) as Shortcut[];
            // A hand-edited or truncated entry must not blank the panel.
            return Array.isArray(parsed) ? parsed : [...DEFAULT_SHORTCUTS];
        } catch {
            return [...DEFAULT_SHORTCUTS];
        }
    }

    private _write(shortcuts: Shortcut[]): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
        } catch {
            // Storage disabled — the panel still works for this session.
        }
    }

    private _newId(): string {
        return crypto.randomUUID?.() ?? `shortcut-${Date.now()}`;
    }
}
