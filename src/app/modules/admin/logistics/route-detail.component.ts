import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { CrudRow } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

/** Row keys already shown in the header — hidden from the raw fields grid. */
const DERIVED_ROW_KEYS = new Set(['id']);

/**
 * Admin ▸ Logistics ▸ Routes ▸ Detail — read-only route overview (fields +
 * stops), reached from the routes list. See {@link RoutesListComponent} for
 * why this is view-only for Admin.
 */
@Component({
    selector: 'admin-route-detail',
    templateUrl: './route-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        MatTooltipModule,
        TranslocoModule,
    ],
})
export class RouteDetailComponent implements OnInit {
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly route = signal<CrudRow | null>(null);
    readonly loading = signal(false);
    readonly notFound = signal(false);

    /** Hub-staff's sorting task progress for this route (admin = read-only). */
    readonly sortingProgress = signal<CrudRow | null>(null);
    readonly loadingSortingProgress = signal(false);

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('routeId') ?? '';
        const passed = (history.state?.route ?? null) as CrudRow | null;
        if (passed && passed.id === id) {
            this.route.set(passed);
            this._loadSortingProgress(passed, id);
        } else if (id) {
            this._fetch(id);
        } else {
            this.notFound.set(true);
        }
    }

    goBack(): void {
        void this._router.navigate(['/admin/routes']);
    }

    detailEntries(row: CrudRow): { label: string; value: string }[] {
        return this._rawScalars(row)
            .filter(([key]) => !DERIVED_ROW_KEYS.has(key))
            .map(([key, value]) => ({
                label: this._humanize(key),
                value: this._displayValue(key, value),
            }));
    }

    stopsOf(row: CrudRow | null): Record<string, unknown>[] {
        const stops = row?.['stops'];
        return Array.isArray(stops) ? (stops as Record<string, unknown>[]) : [];
    }

    stopEntries(
        stop: Record<string, unknown>
    ): { label: string; value: string }[] {
        return this._rawScalars(stop).map(([key, value]) => ({
            label: this._humanize(key),
            value: this._displayValue(key, value),
        }));
    }

    sortingProgressEntries(row: CrudRow): { label: string; value: string }[] {
        return this._rawScalars(row).map(([key, value]) => ({
            label: this._humanize(key),
            value: this._displayValue(key, value),
        }));
    }

    private _fetch(id: string): void {
        this.loading.set(true);
        this._logistics
            .getRoute(id)
            .then((row) => {
                this.route.set(row);
                this.notFound.set(!row);
                this._loadSortingProgress(row, id);
            })
            .catch(() => this.notFound.set(true))
            .finally(() => this.loading.set(false));
    }

    /** Only fetched when the route's own record names its hub (`hubId`). */
    private _loadSortingProgress(row: CrudRow | null, routeId: string): void {
        const hubId = row?.['hubId'];
        if (typeof hubId !== 'string' || !hubId) {
            return;
        }
        this.loadingSortingProgress.set(true);
        this._logistics
            .getSortingProgress(hubId, routeId)
            .then((progress) => this.sortingProgress.set(progress))
            .catch(() => this.sortingProgress.set(null))
            .finally(() => this.loadingSortingProgress.set(false));
    }

    private _rawScalars(obj: unknown): [string, unknown][] {
        if (!obj || typeof obj !== 'object') {
            return [];
        }
        return Object.entries(obj as Record<string, unknown>).filter(
            ([, v]) =>
                v === null ||
                v === undefined ||
                ['string', 'number', 'boolean'].includes(typeof v)
        );
    }

    private _humanize(key: string): string {
        const spaced = key
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\bId\b/gi, 'ID')
            .trim();
        return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    }

    private _displayValue(key: string, value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        if (typeof value === 'boolean') {
            return value ? '✓' : '✗';
        }
        if (typeof value === 'string' && /(At|Date)$/.test(key)) {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                return date.toLocaleString(this._transloco.getActiveLang());
            }
        }
        return String(value);
    }
}
