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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DateTime } from 'luxon';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { CrudRow } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

/** Pill class for a route status — same lifecycle-coloring idiom used elsewhere. */
function routeStatusPillClass(status: string | null | undefined): string {
    switch (String(status ?? '').toLowerCase()) {
        case 'completed':
        case 'delivered':
            return 'admin-pill admin-pill-success';
        case 'cancelled':
        case 'failed':
            return 'admin-pill admin-pill-danger';
        case 'in_progress':
        case 'active':
        case 'dispatched':
            return 'admin-pill admin-pill-warning';
        case 'reviewed':
        case 'assigned':
            return 'admin-pill admin-pill-purple';
        case 'selected':
        case 'optimized':
            return 'admin-pill admin-pill-cyan';
        case 'draft':
        case 'calculated':
            return 'admin-pill admin-pill-info';
        default:
            return 'admin-pill admin-pill-neutral';
    }
}

/**
 * Admin ▸ Logistics ▸ Routes — read-only oversight of delivery routes
 * (M9 Logistics: "Route options / VRP / review" is `R` for Admin per
 * ROLE_MATRIX; VRP calculate/optimize/assign stays Operations Manager's
 * dedicated dispatch workflow). Defaults to today's service date since routes
 * accumulate daily.
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
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly statusPillClass = routeStatusPillClass;

    readonly rows = signal<CrudRow[]>([]);
    readonly loading = signal(false);
    readonly loadingMore = signal(false);
    readonly nextCursor = signal<string | undefined>(undefined);

    readonly serviceDate = new FormControl<DateTime | null>(DateTime.now());
    readonly status = new FormControl('', { nonNullable: true });

    ngOnInit(): void {
        this._load();
        this.serviceDate.valueChanges.subscribe(() => this._load());
        this.status.valueChanges.subscribe(() => this._load());
    }

    openDetail(row: CrudRow): void {
        this._router.navigate(['/admin/routes', row.id], {
            state: { route: row },
        });
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
            })
            .then((res) => {
                this.rows.set(res.rows);
                this.nextCursor.set(res.nextCursor);
            })
            .catch(() => {
                this.rows.set([]);
                this.nextCursor.set(undefined);
            })
            .finally(() => this.loading.set(false));
    }
}
