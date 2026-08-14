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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DateTime } from 'luxon';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { CrudOption, CrudRow } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';
import { ROUTE_STATUSES } from './logistics-admin.types';
import {
    routeStatusLabelKey,
    routeStatusPillClass,
    routeTypeLabelKey,
} from './route-status';

/**
 * Admin ▸ Logistics ▸ Routes — the day's delivery routes (M9 Logistics, admin
 * = Full). "New route" opens the calculate form; a row opens the dispatch
 * console where the route is selected / optimized / reviewed / assigned.
 * Defaults to today's service date since routes accumulate daily.
 */
@Component({
    selector: 'admin-routes-list',
    templateUrl: './routes-list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatDatepickerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
    styles: [
        `
            .routes-grid {
                grid-template-columns:
                    minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.7fr)
                    minmax(0, 0.9fr) minmax(0, 0.9fr) 5rem;
            }
        `,
    ],
})
export class RoutesListComponent implements OnInit {
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly statusPillClass = routeStatusPillClass;
    readonly statusLabelKey = routeStatusLabelKey;
    readonly typeLabelKey = routeTypeLabelKey;
    readonly statusOptions = ROUTE_STATUSES;

    readonly rows = signal<CrudRow[]>([]);
    readonly hubs = signal<CrudOption[]>([]);
    readonly loading = signal(false);
    readonly loadingMore = signal(false);
    readonly nextCursor = signal<string | undefined>(undefined);

    readonly serviceDate = new FormControl<DateTime | null>(DateTime.now());
    readonly status = new FormControl('', { nonNullable: true });
    readonly hubId = new FormControl('', { nonNullable: true });

    ngOnInit(): void {
        // "Plan the day" lands here for the date it planned, not today.
        const planned = this._route.snapshot.queryParamMap.get('serviceDate');
        const parsed = planned ? DateTime.fromISO(planned) : null;
        if (parsed?.isValid) {
            this.serviceDate.setValue(parsed, { emitEvent: false });
        }

        void this._logistics
            .hubOptions()
            .then((options) => this.hubs.set(options));
        this._load();
        this.serviceDate.valueChanges.subscribe(() => this._load());
        this.status.valueChanges.subscribe(() => this._load());
        this.hubId.valueChanges.subscribe(() => this._load());
    }

    openDetail(row: CrudRow): void {
        void this._router.navigate(['/admin/routes', row.id], {
            state: { route: row },
        });
    }

    createRoute(): void {
        void this._router.navigate(['/admin/routes/new']);
    }

    loadMore(): void {
        const cursor = this.nextCursor();
        if (!cursor || this.loadingMore()) {
            return;
        }
        this.loadingMore.set(true);
        this._logistics
            .listRoutes({
                serviceDate: this._isoDate(),
                status: this.status.value,
                hubId: this.hubId.value,
                cursor,
            })
            .then((res) => {
                this.rows.update((rows) => [...rows, ...res.rows]);
                this.nextCursor.set(res.nextCursor);
            })
            .finally(() => this.loadingMore.set(false));
    }

    trackById(index: number, row: CrudRow): string {
        return row.id || String(index);
    }

    formatDate(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    private _isoDate(): string | undefined {
        const value = this.serviceDate.value;
        return value && DateTime.isDateTime(value) && value.isValid
            ? value.toISODate() ?? undefined
            : undefined;
    }

    private _load(): void {
        this.loading.set(true);
        this._logistics
            .listRoutes({
                serviceDate: this._isoDate(),
                status: this.status.value,
                hubId: this.hubId.value,
            })
            .then((res) => {
                this.rows.set(newestActiveFirst(res.rows));
                this.nextCursor.set(res.nextCursor);
            })
            .catch(() => {
                this.rows.set([]);
                this.nextCursor.set(undefined);
            })
            .finally(() => this.loading.set(false));
    }
}

import { newestActiveFirst } from '../shared/row-order';
