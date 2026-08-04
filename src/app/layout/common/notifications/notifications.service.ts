import { Injectable, computed, signal } from '@angular/core';
import {
    extractList,
    extractNextCursor,
    parseJson,
} from 'app/core/api/envelope';
import { notificationApi } from 'contract';
import { NotificationView } from './notifications.types';

interface RawRow {
    [key: string]: unknown;
}

/** First non-empty string value among `keys` on `row`. */
function str(row: RawRow, keys: string[]): string {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === 'string' && value.trim() !== '') {
            return value;
        }
    }
    return '';
}

const PAGE_SIZE = 20;

/**
 * The signed-in user's notifications (`GET /notifications`,
 * `PATCH /notifications/{id}/read`). The backend only supports listing
 * (cursor-paginated, filtered by read state via `is_read`) and marking a
 * single notification read — there is no delete and no mark-all-read endpoint,
 * so the UI built on this service does not offer those actions.
 *
 * Response bodies are untyped in the spec, so rows are parsed defensively —
 * same convention as `catalog.service.ts` / `favorites.service.ts`.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
    private readonly _items = signal<NotificationView[]>([]);
    private readonly _loaded = signal(false);
    private readonly _cursor = signal<string | undefined>(undefined);
    private readonly _hasMore = signal(false);
    private _loading: Promise<void> | null = null;

    /**
     * The rejection behind the last failed call, or `null`. Kept raw so each
     * surface localizes it with `describeApiError` and its own fallback — the
     * service stays free of Transloco.
     */
    private readonly _error = signal<unknown>(null);
    /** `is_read` filter: `undefined` = all, `false` = unread only. */
    private readonly _unreadOnly = signal(false);

    readonly items = this._items.asReadonly();
    readonly loaded = this._loaded.asReadonly();
    readonly hasMore = this._hasMore.asReadonly();
    readonly error = this._error.asReadonly();
    readonly unreadOnly = this._unreadOnly.asReadonly();
    readonly unreadCount = computed(
        () => this._items().filter((item) => !item.isRead).length
    );

    /** Loads the first page once; safe to call from multiple entry points. */
    async ensureLoaded(): Promise<void> {
        if (this._loaded()) {
            return;
        }
        if (!this._loading) {
            this._loading = this._load(undefined, true);
        }
        return this._loading;
    }

    /** Appends the next cursor page, if any. */
    async loadMore(): Promise<void> {
        if (!this._hasMore()) {
            return;
        }
        await this._load(this._cursor(), false);
    }

    /** Re-reads the first page — the retry action on an error state. */
    async reload(): Promise<void> {
        this._loading = this._load(undefined, true);
        await this._loading;
    }

    /**
     * Switches the `is_read` filter and re-reads. The endpoint filters
     * server-side, so an unread-only view must not be faked client-side: the
     * unread items on later pages would never be fetched.
     */
    async setUnreadOnly(unreadOnly: boolean): Promise<void> {
        this._unreadOnly.set(unreadOnly);
        await this.reload();
    }

    /** Clears the stored rejection once a surface has shown it. */
    clearError(): void {
        this._error.set(null);
    }

    /** Marks one notification read, optimistically, reverting on failure. */
    async markRead(id: string): Promise<void> {
        const item = this._items().find((i) => i.id === id);
        if (!item || item.isRead) {
            return;
        }
        const previous = this._items();
        this._items.set(
            previous.map((i) => (i.id === id ? { ...i, isRead: true } : i))
        );
        try {
            await notificationApi.apiV1NotificationsIdReadPatch({ id });
        } catch (err) {
            // Revert the optimistic read and keep the reason: a badge that
            // silently comes back needs an explanation.
            this._items.set(previous);
            this._error.set(err);
        }
    }

    private async _load(
        cursor: string | undefined,
        replace: boolean
    ): Promise<void> {
        this._error.set(null);
        try {
            const res = await notificationApi.apiV1NotificationsGetRaw({
                cursor,
                pageSize: PAGE_SIZE,
                isRead: this._unreadOnly() ? false : undefined,
            });
            const body = await parseJson(res.raw);
            const rows = extractList<RawRow>(body);
            const views = rows.map((row) => this._toView(row));
            this._items.set(replace ? views : [...this._items(), ...views]);
            const next = extractNextCursor(body);
            this._cursor.set(next);
            this._hasMore.set(!!next);
        } catch (err) {
            // A failed read is not "no notifications" — record why so the
            // panel can say so and offer a retry.
            if (replace) {
                this._items.set([]);
                this._hasMore.set(false);
            }
            this._error.set(err);
        } finally {
            this._loaded.set(true);
        }
    }

    private _toView(row: RawRow): NotificationView {
        return {
            id: str(row, ['id', 'notificationId']),
            title: str(row, ['title', 'subject', 'heading']),
            description: str(row, ['body', 'message', 'description']),
            link: str(row, ['link', 'url']) || null,
            createdAt: str(row, ['createdAt', 'time', 'sentAt']),
            isRead: row['isRead'] === true || row['read'] === true,
        };
    }
}
