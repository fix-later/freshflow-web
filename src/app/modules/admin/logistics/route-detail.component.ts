import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { DateTime } from 'luxon';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { CrudOption, CrudRow } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';
import {
    LoadingManifest,
    OPTIMIZATION_CRITERIA,
    OptimizationCriterion,
    RouteEligibility,
    RouteStop,
} from './logistics-admin.types';
import { routeStatusPillClass } from './route-status';

/**
 * Statuses a route passes through *before* it can take a vehicle and driver.
 * `reviewed` is the one that opens the assign panel; everything here still has
 * a step to go.
 */
const PRE_REVIEW_STATUSES = ['draft', 'planned', 'calculated', 'selected'];

/** Statuses where the truck is already assigned — or the route is over. */
const POST_ASSIGN_STATUSES = [
    'assigned',
    'dispatched',
    'in_progress',
    'completed',
    'delivered',
    'cancelled',
    'failed',
];

/** Statuses whose route already has a truck load worth listing. */
const MANIFEST_STATUSES = new Set([
    'reviewed',
    'assigned',
    'in_progress',
    'completed',
]);

/** Row keys rendered by a dedicated block — hidden from the raw fields grid. */
const DERIVED_ROW_KEYS = new Set([
    'id',
    'routeId',
    'stops',
    'status',
    'routeType',
    'serviceDate',
    'optimizationCriteria',
    'totalDistanceKm',
    'estimatedDurationMinutes',
    'estimatedCost',
    'vehicleId',
    'driverUserId',
]);

/**
 * Admin ▸ Logistics ▸ Routes ▸ Detail — the route's dispatch console.
 *
 * Admin drives the whole lifecycle from here (M9 Logistics, admin = Full):
 * `planned` → select → optimize → review (with optional manual stop reorder)
 * → assign a vehicle + driver. Each action is gated on the status the backend
 * accepts it in, so a button is only offered when the transition is legal.
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
        MatFormFieldModule,
        MatIconModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class RouteDetailComponent implements OnInit {
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly statusPillClass = routeStatusPillClass;
    readonly criteriaOptions = OPTIMIZATION_CRITERIA;

    readonly route = signal<CrudRow | null>(null);
    readonly loading = signal(false);
    readonly notFound = signal(false);
    readonly acting = signal(false);

    /** Local stop order — diverges from the route only while reordering. */
    readonly stops = signal<RouteStop[]>([]);
    readonly reordered = signal(false);

    readonly criteria = new FormControl<OptimizationCriterion>('cost', {
        nonNullable: true,
    });
    readonly vehicleId = new FormControl('', { nonNullable: true });
    readonly driverUserId = new FormControl('', { nonNullable: true });

    readonly vehicleOptions = signal<CrudOption[]>([]);
    readonly driverOptions = signal<CrudOption[]>([]);
    readonly eligibility = signal<RouteEligibility | null>(null);
    readonly checkingEligibility = signal(false);

    readonly manifest = signal<LoadingManifest | null>(null);
    readonly loadingManifest = signal(false);

    /** Hub-staff's sorting task progress for this route (admin = read-only). */
    readonly sortingProgress = signal<CrudRow | null>(null);
    readonly loadingSortingProgress = signal(false);

    readonly status = computed(() =>
        String(this.route()?.['status'] ?? '').toLowerCase()
    );
    readonly isOptimized = computed(
        () => !!this.route()?.['optimizationCriteria']
    );

    readonly canSelect = computed(() => this.status() === 'planned');
    readonly canOptimize = computed(() =>
        ['planned', 'selected'].includes(this.status())
    );
    readonly canReorder = computed(() => this.status() === 'selected');
    readonly canReview = computed(
        () => this.status() === 'selected' && this.isOptimized()
    );
    readonly canAssign = computed(() => this.status() === 'reviewed');

    /**
     * Why the assign panel is not on screen, when it is not.
     *
     * Each action section is a bare `@if` on the route's status, so a stage the
     * route has not reached renders *nothing* — the vehicle/driver form simply
     * is not there, with no indication that it exists at all or what brings it
     * up. `reviewed` is the only status that opens it, and the path to
     * `reviewed` (select → optimize → review) is three screens' worth of
     * knowledge to expect from someone looking for a dropdown.
     *
     * `null` when the panel is showing, or when the route is in a state where
     * assignment is genuinely over.
     */
    readonly assignBlockedReason = computed(() => {
        if (this.canAssign()) {
            return null;
        }
        const status = this.status();
        if (!status) {
            return null;
        }
        if (PRE_REVIEW_STATUSES.includes(status)) {
            return this.isOptimized()
                ? 'admin.routes.actions.assignAfterReview'
                : 'admin.routes.actions.assignAfterOptimize';
        }
        return POST_ASSIGN_STATUSES.includes(status)
            ? 'admin.routes.actions.assignAlreadyDone'
            : null;
    });

    /** Summary tiles rendered above the stops (typed `RouteDto` fields). */
    readonly summary = computed(() => {
        const row = this.route();
        if (!row) {
            return [];
        }
        const vehicleLabel = this._labelOf(
            this.vehicleOptions(),
            row['vehicleId']
        );
        const driverLabel = this._labelOf(
            this.driverOptions(),
            row['driverUserId']
        );
        return [
            {
                label: 'admin.routes.detailPage.serviceDate',
                value: this._formatDate(row['serviceDate'], true),
            },
            {
                label: 'admin.routes.table.type',
                value: this._text(row['routeType']),
            },
            {
                label: 'admin.routes.detailPage.criteria',
                value: row['optimizationCriteria']
                    ? this._transloco.translate(
                          'admin.routes.criteria.' +
                              String(row['optimizationCriteria']).toLowerCase()
                      )
                    : '—',
            },
            {
                label: 'admin.routes.table.distance',
                value:
                    row['totalDistanceKm'] == null
                        ? '—'
                        : `${row['totalDistanceKm']} km`,
            },
            {
                label: 'admin.routes.detailPage.duration',
                value:
                    row['estimatedDurationMinutes'] == null
                        ? '—'
                        : this._transloco.translate(
                              'admin.routes.detailPage.minutes',
                              { count: row['estimatedDurationMinutes'] }
                          ),
            },
            {
                label: 'admin.routes.detailPage.cost',
                value: this._formatMoney(row['estimatedCost']),
            },
            {
                label: 'admin.routes.detailPage.vehicle',
                value: vehicleLabel,
            },
            {
                label: 'admin.routes.detailPage.driver',
                value: driverLabel,
            },
        ];
    });

    ngOnInit(): void {
        void this._logistics
            .vehicleOptions()
            .then((options) => this.vehicleOptions.set(options));
        void this._logistics
            .driverOptions()
            .then((options) => this.driverOptions.set(options));

        const id = this._route.snapshot.paramMap.get('routeId') ?? '';
        const passed = (history.state?.route ?? null) as CrudRow | null;
        if (passed && passed.id === id) {
            this._apply(passed);
            this._loadSortingProgress(passed);
            this._loadManifest(passed);
        } else if (id) {
            this._fetch(id);
        } else {
            this.notFound.set(true);
        }
    }

    goBack(): void {
        void this._router.navigate(['/admin/routes']);
    }

    // ---- Lifecycle actions ------------------------------------------------

    select(): void {
        this._run(
            (id) => this._logistics.selectRoute(id),
            'admin.routes.actions.selectSuccess'
        );
    }

    optimize(): void {
        this._run(
            (id) => this._logistics.optimizeRoute(id, this.criteria.value),
            'admin.routes.actions.optimizeSuccess'
        );
    }

    review(): void {
        const stopOrder = this.reordered()
            ? this.stops().map((stop) => stop.entityId)
            : undefined;
        this._run(
            (id) => this._logistics.reviewRoute(id, stopOrder),
            'admin.routes.actions.reviewSuccess'
        );
    }

    /** The backend requires both a vehicle and a driver to assign a route. */
    assign(): void {
        const vehicleId = this.vehicleId.value;
        const driverUserId = this.driverUserId.value;
        if (!vehicleId || !driverUserId) {
            return;
        }
        this._run(
            (id) => this._logistics.assignVehicle(id, vehicleId, driverUserId),
            'admin.routes.actions.assignSuccess'
        );
    }

    checkEligibility(): void {
        const id = this.route()?.id;
        const vehicleId = this.vehicleId.value;
        if (!id || !vehicleId || this.checkingEligibility()) {
            return;
        }
        this.checkingEligibility.set(true);
        void this._logistics
            .checkEligibility(
                id,
                vehicleId,
                this.driverUserId.value || undefined
            )
            .then((result) => this.eligibility.set(result))
            .catch((err) => {
                this.eligibility.set(null);
                void this._notifyError(err, 'admin.routes.actions.error');
            })
            .finally(() => this.checkingEligibility.set(false));
    }

    /**
     * Pickup stops — the hub the goods leave from — must stay ahead of every
     * dropoff. `DeliveryRoute.BuildReorderedStops` throws
     * "Pickup stops must precede restaurant (dropoff) stops", which the handler
     * turns into `INVALID_STOP_ORDER` (422); the arrows used to allow exactly
     * that ordering and only `$first` / `$last` were disabled, so the refusal
     * arrived after the review had been submitted.
     */
    private _isPickup(stop: RouteStop): boolean {
        return stop.entityType !== 'restaurant';
    }

    /** True when this row may move one place up without breaking that rule. */
    canMoveUp(index: number): boolean {
        const stops = this.stops();
        const stop = stops[index];
        if (!stop || index === 0) {
            return false;
        }
        // A pickup never needs to move: they are already the leading block, and
        // swapping two of them changes nothing the backend cares about.
        if (this._isPickup(stop)) {
            return false;
        }
        // A dropoff may not climb above the last pickup.
        return !this._isPickup(stops[index - 1]);
    }

    /** True when this row may move one place down. */
    canMoveDown(index: number): boolean {
        const stops = this.stops();
        const stop = stops[index];
        if (!stop || index >= stops.length - 1) {
            return false;
        }
        // Moving a pickup down would push it past a dropoff.
        return !this._isPickup(stop);
    }

    /** Moves a stop within the local order; persisted by {@link review}. */
    moveStop(index: number, delta: number): void {
        const allowed =
            delta < 0 ? this.canMoveUp(index) : this.canMoveDown(index);
        if (!allowed) {
            return;
        }
        const next = [...this.stops()];
        const target = index + delta;
        if (target < 0 || target >= next.length) {
            return;
        }
        [next[index], next[target]] = [next[target], next[index]];
        this.stops.set(next);
        this.reordered.set(true);
    }

    resetStopOrder(): void {
        this.stops.set(this._stopsOf(this.route()));
        this.reordered.set(false);
    }

    // ---- Formatting -------------------------------------------------------

    /** Reason codes are machine-readable; each gets its own translated line. */
    reasonLabel(code: string): string {
        const key = `admin.routes.eligibility.reasons.${code}`;
        const translated = this._transloco.translate(key);
        return translated === key ? code : translated;
    }

    stopTime(value: string | null | undefined): string {
        return this._formatDate(value);
    }

    lineWeight(quantity: number, capacityKg: number | null): string {
        if (capacityKg == null) {
            return '—';
        }
        const total = quantity * capacityKg;
        return `${total.toLocaleString(this._transloco.getActiveLang())} kg`;
    }

    /** Any remaining scalar fields (ids, timestamps) not shown in the summary. */
    detailEntries(row: CrudRow): { label: string; value: string }[] {
        return Object.entries(row)
            .filter(
                ([key, value]) =>
                    !DERIVED_ROW_KEYS.has(key) &&
                    (value === null ||
                        value === undefined ||
                        ['string', 'number', 'boolean'].includes(typeof value))
            )
            .map(([key, value]) => ({
                label: this._humanize(key),
                value: this._displayValue(key, value),
            }));
    }

    sortingProgressEntries(row: CrudRow): { label: string; value: string }[] {
        return Object.entries(row)
            .filter(
                ([, value]) =>
                    value === null ||
                    value === undefined ||
                    ['string', 'number', 'boolean'].includes(typeof value)
            )
            .map(([key, value]) => ({
                label: this._humanize(key),
                value: this._displayValue(key, value),
            }));
    }

    // ---- Internals --------------------------------------------------------

    /** Runs a lifecycle call, then re-renders from the route it returns. */
    private _run(
        action: (id: string) => Promise<CrudRow | null>,
        successKey: string
    ): void {
        const id = this.route()?.id;
        if (!id || this.acting()) {
            return;
        }
        this.acting.set(true);
        void action(id)
            .then((updated) => {
                this._notify(successKey);
                if (updated) {
                    this._apply(updated);
                    this._loadManifest(updated);
                } else {
                    this._fetch(id);
                }
            })
            .catch(
                (err) =>
                    void this._notifyError(err, 'admin.routes.actions.error')
            )
            .finally(() => this.acting.set(false));
    }

    private _fetch(id: string): void {
        this.loading.set(true);
        void this._logistics
            .getRoute(id)
            .then((row) => {
                if (row) {
                    this._apply(row);
                    this._loadSortingProgress(row);
                    this._loadManifest(row);
                } else {
                    this.notFound.set(true);
                }
            })
            .catch(() => this.notFound.set(true))
            .finally(() => this.loading.set(false));
    }

    private _apply(row: CrudRow): void {
        this.route.set(row);
        this.notFound.set(false);
        this.stops.set(this._stopsOf(row));
        this.reordered.set(false);
        this.eligibility.set(null);
        const criterion = String(
            row['optimizationCriteria'] ?? ''
        ).toLowerCase();
        if (this._isCriterion(criterion)) {
            this.criteria.setValue(criterion);
        }
        if (row['vehicleId']) {
            this.vehicleId.setValue(String(row['vehicleId']));
        }
        if (row['driverUserId']) {
            this.driverUserId.setValue(String(row['driverUserId']));
        }
    }

    private _isCriterion(value: string): value is OptimizationCriterion {
        return (OPTIMIZATION_CRITERIA as readonly string[]).includes(value);
    }

    private _stopsOf(row: CrudRow | null): RouteStop[] {
        const stops = row?.['stops'];
        if (!Array.isArray(stops)) {
            return [];
        }
        return (stops as Record<string, unknown>[])
            .map((stop) => ({
                stopOrder: Number(stop['stopOrder'] ?? 0),
                entityType: String(stop['entityType'] ?? ''),
                entityId: String(stop['entityId'] ?? ''),
                entityName: String(stop['entityName'] ?? ''),
                estimatedArrivalAt: stop['estimatedArrivalAt'] as string | null,
                estimatedDepartureAt: stop['estimatedDepartureAt'] as
                    | string
                    | null,
            }))
            .sort((a, b) => a.stopOrder - b.stopOrder);
    }

    private _loadManifest(row: CrudRow): void {
        if (!MANIFEST_STATUSES.has(String(row['status'] ?? '').toLowerCase())) {
            this.manifest.set(null);
            return;
        }
        this.loadingManifest.set(true);
        void this._logistics
            .getLoadingManifest(row.id)
            .then((manifest) => this.manifest.set(manifest))
            .catch(() => this.manifest.set(null))
            .finally(() => this.loadingManifest.set(false));
    }

    /**
     * Only fetched when the route's own record names its hub (`hubId`).
     * Sorting is tracked per hub-day, so this is the whole hub's progress for
     * the route's service date, not just this route's share of it.
     */
    private _loadSortingProgress(row: CrudRow | null): void {
        const hubId = row?.['hubId'];
        if (typeof hubId !== 'string' || !hubId) {
            return;
        }
        const serviceDate = this._isoDateOf(row?.['serviceDate']);
        this.loadingSortingProgress.set(true);
        void this._logistics
            .getSortingProgress(hubId, serviceDate)
            .then((progress) => this.sortingProgress.set(progress))
            .catch(() => this.sortingProgress.set(null))
            .finally(() => this.loadingSortingProgress.set(false));
    }

    /** `serviceDate` as `yyyy-MM-dd`, however the backend spelled it. */
    private _isoDateOf(value: unknown): string | undefined {
        if (typeof value !== 'string' || !value) {
            return undefined;
        }
        const parsed = DateTime.fromISO(value);
        return parsed.isValid ? parsed.toISODate() ?? undefined : undefined;
    }

    private _labelOf(options: CrudOption[], id: unknown): string {
        if (id == null || id === '') {
            return '—';
        }
        const value = String(id);
        return options.find((o) => o.value === value)?.label ?? value;
    }

    private _text(value: unknown): string {
        return value == null || value === '' ? '—' : String(value);
    }

    private _formatMoney(value: unknown): string {
        if (value == null || value === '') {
            return '—';
        }
        const amount = Number(value);
        return Number.isNaN(amount)
            ? String(value)
            : `${amount.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }

    private _formatDate(value: unknown, dateOnly = false): string {
        if (value == null || value === '') {
            return '—';
        }
        const date = new Date(String(value));
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        const lang = this._transloco.getActiveLang();
        return dateOnly
            ? date.toLocaleDateString(lang)
            : date.toLocaleString(lang);
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
            return this._formatDate(value);
        }
        return String(value);
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    private async _notifyError(
        err: unknown,
        fallbackKey: string
    ): Promise<void> {
        const message = await describeApiError(
            err,
            (key) => this._transloco.translate(key),
            fallbackKey
        );
        this._snackBar.open(message, undefined, { duration: 6000 });
    }
}
