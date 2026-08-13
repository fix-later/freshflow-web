import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import {
    ADMIN_DEFAULT_PAGE_SIZE,
    toApiPage,
    toPageIndex,
} from '../shared/admin-pagination';
import { CoalescedTask } from '../shared/coalesced-task';
import { ScheduledOrdersAdminService } from './scheduled-orders-admin.service';
import {
    AdminScheduledOrder,
    isScheduleCancelled,
    scheduleStatusPillClass,
} from './scheduled-orders-admin.types';

/**
 * Admin ▸ Operations ▸ Scheduled orders — every restaurant's recurring order
 * templates (`GET /orders/scheduled`, RBAC `admin,restaurant`).
 *
 * These are what the generator turns into concrete orders overnight, so a
 * schedule pointed at the wrong recurrence quietly produces wrong orders every
 * day until someone looks. Operations had no view of them at all before this
 * screen: the endpoints admit `admin`, but only the restaurant-facing module
 * called them, always pinned to the caller's own restaurant.
 */
@Component({
    selector: 'admin-scheduled-orders-list',
    templateUrl: './scheduled-orders-list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
    styles: [
        `
            .schedules-grid {
                grid-template-columns:
                    minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.9fr)
                    minmax(0, 0.8fr) 5rem;

                @screen lg {
                    grid-template-columns:
                        minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.9fr)
                        minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 0.8fr) 5rem;
                }
            }
        `,
    ],
})
export class ScheduledOrdersListComponent implements OnInit {
    private readonly _schedules = inject(ScheduledOrdersAdminService);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly statusPillClass = scheduleStatusPillClass;
    readonly isCancelled = isScheduleCancelled;

    readonly schedules = signal<AdminScheduledOrder[]>([]);
    readonly totalCount = signal(0);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly loading = signal(false);
    readonly loadError = signal<string | null>(null);

    readonly restaurantId = new FormControl('', { nonNullable: true });
    /**
     * Off by default, matching the server. A cancelled schedule is otherwise
     * invisible, which makes "why did this stop generating?" unanswerable.
     */
    readonly includeCancelled = new FormControl(false, { nonNullable: true });

    /**
     * A method rather than a `computed()`: it reads form controls, which are
     * not signals, so a computed would take no dependency on them and cache
     * its first answer forever.
     */
    hasActiveFilters(): boolean {
        return !!this.restaurantId.value.trim() || this.includeCancelled.value;
    }

    ngOnInit(): void {
        this._load();
        const onFilterChange = (): void => {
            this.pageIndex.set(0);
            this._load();
        };
        this.restaurantId.valueChanges.subscribe(onFilterChange);
        this.includeCancelled.valueChanges.subscribe(onFilterChange);
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
        this._load();
    }

    clearFilters(): void {
        this.restaurantId.setValue('');
        this.includeCancelled.setValue(false);
    }

    reload(): void {
        this._load();
    }

    openDetail(row: AdminScheduledOrder): void {
        if (!row.id) {
            return;
        }
        this._router.navigate(['/admin/scheduled-orders', row.id], {
            state: { schedule: row },
        });
    }

    trackById(index: number, row: AdminScheduledOrder): string {
        return row.id || String(index);
    }

    /** Localized recurrence, falling back to the raw value if unrecognised. */
    recurrenceLabel(value: string | null | undefined): string {
        const token = String(value ?? '')
            .trim()
            .toLowerCase();
        if (!token) {
            return '—';
        }
        const key = `admin.scheduledOrders.recurrence.${token}`;
        const translated = this._transloco.translate(key);
        return translated === key ? token : translated;
    }

    statusLabel(row: AdminScheduledOrder): string {
        return this._transloco.translate(
            isScheduleCancelled(row)
                ? 'admin.scheduledOrders.status.cancelled'
                : 'admin.scheduledOrders.status.active'
        );
    }

    formatDate(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    /**
     * Date-only, for `firstRunAt` specifically: every run delivers in the same
     * fixed early-morning window (see `DELIVERY_HOUR` in the restaurant-facing
     * `scheduled-orders.component.ts`), so the stored instant's clock time —
     * unlike `createdAt`/`lastExecutedAt`, which are real recorded events — would
     * read as an exact minute rather than the window it actually stands for.
     */
    formatRunDate(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleDateString(this._transloco.getActiveLang());
    }

    private _load(): void {
        this._loadTask.trigger();
    }

    private readonly _loadTask = new CoalescedTask(async () => {
        this.loading.set(true);
        this.loadError.set(null);
        try {
            const result = await this._schedules.getScheduledOrders({
                restaurantId: this.restaurantId.value.trim() || undefined,
                includeCancelled: this.includeCancelled.value,
                page: toApiPage(this.pageIndex()),
                pageSize: this.pageSize(),
            });
            this.schedules.set(result.schedules);
            this.totalCount.set(result.totalCount);
            if (result.page) {
                this.pageIndex.set(toPageIndex(result.page));
            }
            if (result.pageSize) {
                this.pageSize.set(result.pageSize);
            }
        } catch (err) {
            this.schedules.set([]);
            this.totalCount.set(0);
            // "No schedules" and "the read failed" look identical otherwise,
            // and believing the first one hides every recurring order there is.
            this.loadError.set(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'admin.scheduledOrders.loadError'
                )
            );
        } finally {
            this.loading.set(false);
        }
    });
}
