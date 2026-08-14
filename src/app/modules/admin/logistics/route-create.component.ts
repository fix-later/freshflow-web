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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { DateTime } from 'luxon';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { LogisticsAdminService } from './logistics-admin.service';
import {
    HubOption,
    OPTIMIZATION_CRITERIA,
    OptimizationCriterion,
    RouteSuggestionItem,
} from './logistics-admin.types';

/**
 * Most restaurants one route may serve.
 *
 * `CalculateRouteCommandHandler` refuses when
 * `DestinationRestaurantIds.Count + 1 > 20` — **the hub is itself a stop**, so
 * the 20-stop route holds 19 destinations. Counting 20 restaurants here let the
 * 20th through the gate and answered `STOP_LIMIT_EXCEEDED` (422) instead.
 */
const MAX_STOPS = 19;

/** What the backend counts, hub included — used in the "x / 20 stops" copy. */
const MAX_ROUTE_STOPS = MAX_STOPS + 1;

/**
 * Admin ▸ Logistics ▸ Routes ▸ New — builds a delivery route for a service
 * date (`POST /logistics/routes/calculate`, status `planned`).
 *
 * A route leaves from one hub and stops at the restaurants waiting on that
 * hub's goods, so the form picks a hub plus its delivery stops. The restaurant
 * list is seeded from `/routes/suggestions`, which lists who actually has
 * goods waiting that day with their order counts — so a restaurant with stock
 * at the hub can't be silently left off the truck. "Show all" falls back to
 * the full restaurant list for a day the suggestions come back empty.
 *
 * "Plan the day" hands the same hub + date to `POST /logistics/routes/plan`
 * and lets the backend split the stops across as many routes as it needs,
 * instead of Admin building each one by hand.
 */
@Component({
    selector: 'admin-route-create',
    templateUrl: './route-create.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class RouteCreateComponent implements OnInit {
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly criteriaOptions = OPTIMIZATION_CRITERIA;
    readonly maxStops = MAX_STOPS;
    /** The hub-inclusive figure, so the warning can explain where 19 comes from. */
    readonly maxRouteStops = MAX_ROUTE_STOPS;

    readonly serviceDate = new FormControl<DateTime | null>(DateTime.now());
    readonly criteria = new FormControl<OptimizationCriterion>('cost', {
        nonNullable: true,
    });
    readonly includeBatched = new FormControl(false, { nonNullable: true });
    readonly hubId = new FormControl('', { nonNullable: true });

    readonly hubs = signal<HubOption[]>([]);
    /** False until `hubOptions()` has answered, so "no hubs" ≠ "still loading". */
    readonly hubsLoaded = signal(false);
    readonly restaurants = signal<RouteSuggestionItem[]>([]);
    /** Hubs the day suggests, with their waiting-order counts. */
    readonly suggestedHubs = signal<RouteSuggestionItem[]>([]);
    readonly selectedRestaurants = signal<Set<string>>(new Set());

    /**
     * Signal mirror of the `hubId` control.
     *
     * The gates below are `computed()`, and a `FormControl`'s `.value` is not a
     * signal — reading it inside a computed creates no dependency, so the
     * computed never recomputes when the hub changes. `canPlan` depended on
     * nothing else, so it evaluated once at first render (hub still empty),
     * cached `false`, and the "Plan the day" button stayed disabled forever
     * even after `hubOptions()` resolved and selected a hub.
     */
    readonly selectedHubId = signal('');

    readonly loading = signal(false);
    readonly calculating = signal(false);
    readonly planning = signal(false);
    readonly showingAll = signal(false);

    /** The hub is the origin, so the stops are the delivery destinations. */
    readonly stopCount = computed(() => this.selectedRestaurants().size);
    readonly tooManyStops = computed(() => this.stopCount() > MAX_STOPS);
    readonly busy = computed(() => this.calculating() || this.planning());

    readonly canCalculate = computed(
        () =>
            !!this.selectedHubId() &&
            this.selectedHubHasCoordinates() &&
            this.selectedRestaurants().size > 0 &&
            !this.tooManyStops() &&
            !this.busy()
    );
    readonly canPlan = computed(
        () =>
            !!this.selectedHubId() &&
            this.selectedHubHasCoordinates() &&
            !this.busy()
    );

    /**
     * Why the actions are unavailable, as an i18n key — a disabled pair of
     * buttons with no explanation is indistinguishable from a broken screen,
     * which is exactly how this looked when no hub was configured.
     */
    readonly blockedReason = computed(() => {
        if (this.hubsLoaded() && !this.hubs().length) {
            return 'admin.routes.create.blocked.noHubs';
        }
        if (!this.selectedHubId()) {
            return 'admin.routes.create.blocked.noHubSelected';
        }
        // The hub is the route's first stop, so one without coordinates is
        // refused by `CalculateRouteCommandHandler` before anything else is
        // read. Saying so here points at the fix — edit the hub's address —
        // instead of spending a request to be told "missing coordinates".
        if (!this.selectedHubHasCoordinates()) {
            return 'admin.routes.create.blocked.hubNoCoordinates';
        }
        return null;
    });

    /** False only when the chosen hub is known to have no coordinates. */
    readonly selectedHubHasCoordinates = computed(() => {
        const id = this.selectedHubId();
        const hub = this.hubs().find((option) => option.value === id);
        // Unknown hub (list still loading) is not a refusal — the other gates
        // already cover "nothing selected".
        return !hub || hub.hasCoordinates;
    });

    /** Same, for the calculate button only — planning needs no stops picked. */
    readonly calculateBlockedReason = computed(() => {
        const shared = this.blockedReason();
        if (shared) {
            return shared;
        }
        if (this.tooManyStops()) {
            return null; // already shown by the stop-limit warning
        }
        return this.selectedRestaurants().size === 0
            ? 'admin.routes.create.blocked.noRestaurantsSelected'
            : null;
    });

    ngOnInit(): void {
        // Subscribed before the async `setValue` below so the very first hub
        // selection is captured too.
        this.hubId.valueChanges.subscribe((value) =>
            this.selectedHubId.set(value ?? '')
        );

        void this._logistics
            .hubOptions()
            .then((options) => {
                this.hubs.set(options);
                this._applyHubSuggestions();
            })
            .finally(() => this.hubsLoaded.set(true));
        this._loadSuggestions();
        this.serviceDate.valueChanges.subscribe(() => this._loadSuggestions());
        this.includeBatched.valueChanges.subscribe(() =>
            this._loadSuggestions()
        );
    }

    goBack(): void {
        void this._router.navigate(['/admin/routes']);
    }

    /**
     * No hub configured is the one blocker fixed on another screen — the chợ
     * list, since a hub is created from its market's hub tab.
     */
    goToHubs(): void {
        void this._router.navigate(['/admin/markets']);
    }

    isRestaurantSelected(id: string): boolean {
        return this.selectedRestaurants().has(id);
    }

    toggleRestaurant(id: string, checked: boolean): void {
        this.selectedRestaurants.set(
            this._toggled(this.selectedRestaurants(), id, checked)
        );
    }

    selectAllRestaurants(): void {
        this.selectedRestaurants.set(
            new Set(this.restaurants().map((item) => item.id))
        );
    }

    clearRestaurants(): void {
        this.selectedRestaurants.set(new Set());
    }

    /** Falls back to every restaurant, not just the day's suggestions. */
    showAll(): void {
        if (this.showingAll() || this.loading()) {
            return;
        }
        this.loading.set(true);
        void this._logistics
            .restaurantOptions()
            .then((restaurantOpts) => {
                this.showingAll.set(true);
                this.restaurants.set(
                    this._merge(
                        this.restaurants(),
                        restaurantOpts.map((o) => ({
                            id: o.value,
                            name: o.label,
                            orderCount: 0,
                        }))
                    )
                );
            })
            .finally(() => this.loading.set(false));
    }

    calculate(): void {
        const isoDate = this._isoDate();
        if (!isoDate || !this.canCalculate()) {
            return;
        }
        this.calculating.set(true);
        void this._logistics
            .calculateRoute({
                serviceDate: isoDate,
                hubId: this.hubId.value,
                destinationRestaurantIds: [...this.selectedRestaurants()],
                optimizationCriteria: this.criteria.value,
            })
            .then((route) => {
                this._notify('admin.routes.create.success');
                void this._router.navigate(
                    route?.id ? ['/admin/routes', route.id] : ['/admin/routes'],
                    route ? { state: { route } } : {}
                );
            })
            .catch(
                (err) =>
                    void this._notifyError(err, 'admin.routes.create.error')
            )
            .finally(() => this.calculating.set(false));
    }

    /**
     * Lets the backend build every route the hub needs for the day.
     *
     * The endpoint plans a **market session**, so the hub and date chosen here
     * are resolved to one first. A day with no session open cannot be planned —
     * said plainly, rather than as the 404 the API would answer with.
     */
    plan(): void {
        const isoDate = this._isoDate();
        if (!isoDate || !this.canPlan()) {
            return;
        }
        this.planning.set(true);
        void this._logistics
            .marketSessionIdFor(this.hubId.value, isoDate)
            .then((marketSessionId) => {
                if (!marketSessionId) {
                    this._notify('admin.routes.create.noSession');
                    return [];
                }
                return this._logistics.planRoutes({
                    marketSessionId,
                    optimizationCriteria: this.criteria.value,
                });
            })
            .then((routes) => {
                if (!routes.length) {
                    return;
                }
                this._notify('admin.routes.create.planSuccess', {
                    count: routes.length,
                });
                void this._router.navigate(['/admin/routes'], {
                    queryParams: { serviceDate: isoDate },
                });
            })
            .catch(
                (err) =>
                    void this._notifyError(err, 'admin.routes.create.error')
            )
            .finally(() => this.planning.set(false));
    }

    private _loadSuggestions(): void {
        const isoDate = this._isoDate();
        if (!isoDate) {
            return;
        }
        this.loading.set(true);
        this.showingAll.set(false);
        void this._logistics
            .getRouteSuggestions(isoDate, this.includeBatched.value)
            .then((suggestions) => {
                this.restaurants.set(suggestions.restaurants);
                this.suggestedHubs.set(suggestions.hubs);
                this._applyHubSuggestions();
                this._preselect(suggestions.restaurants);
            })
            .catch(() => {
                this.restaurants.set([]);
                this.suggestedHubs.set([]);
                this.selectedRestaurants.set(new Set());
            })
            .finally(() => this.loading.set(false));
    }

    /**
     * Orders the hub picker by what the day actually needs and selects one that
     * has goods waiting.
     *
     * The suggestions name the hubs with orders on this service date; the hub
     * list names every active hub. Both are wanted — Admin may deliberately
     * route from a quiet hub — so nothing is removed, but the ones with work
     * lead the list and carry their order count, and the default selection is
     * one of them instead of whichever hub happened to be created first.
     *
     * Runs after either source resolves, since their order is not guaranteed.
     */
    private _applyHubSuggestions(): void {
        const counts = new Map(
            this.suggestedHubs().map((hub) => [hub.id, hub.orderCount])
        );
        const ranked = [...this.hubs()]
            .map((hub) => ({ ...hub, orderCount: counts.get(hub.value) ?? 0 }))
            .sort(
                (a, b) =>
                    b.orderCount - a.orderCount ||
                    a.label.localeCompare(b.label)
            );
        this.hubs.set(ranked);

        const current = this.hubId.value;
        const currentHasWork = (counts.get(current) ?? 0) > 0;
        if (current && currentHasWork) {
            return;
        }
        // Prefer a hub with goods; fall back to the first one so the picker is
        // never left empty when nothing is waiting anywhere.
        const preferred = ranked.find((hub) => hub.orderCount > 0) ?? ranked[0];
        if (preferred && preferred.value !== current) {
            this.hubId.setValue(preferred.value);
        }
    }

    /**
     * Everything the day suggests is preselected when it fits in one route —
     * the common case is "send today's goods out". Above the stop limit the
     * split is Admin's call (or "Plan the day"'s), so nothing is preselected.
     */
    private _preselect(restaurants: RouteSuggestionItem[]): void {
        const fits = restaurants.length <= MAX_STOPS;
        this.selectedRestaurants.set(
            fits ? new Set(restaurants.map((r) => r.id)) : new Set()
        );
    }

    private _toggled(
        current: Set<string>,
        id: string,
        checked: boolean
    ): Set<string> {
        const next = new Set(current);
        if (checked) {
            next.add(id);
        } else {
            next.delete(id);
        }
        return next;
    }

    /** Keeps the suggested entries (with their order counts) ahead of the rest. */
    private _merge(
        suggested: RouteSuggestionItem[],
        all: RouteSuggestionItem[]
    ): RouteSuggestionItem[] {
        const known = new Set(suggested.map((item) => item.id));
        return [...suggested, ...all.filter((item) => !known.has(item.id))];
    }

    private _isoDate(): string | undefined {
        const value = this.serviceDate.value;
        return value && DateTime.isDateTime(value) && value.isValid
            ? value.toISODate() ?? undefined
            : undefined;
    }

    private _notify(key: string, params?: Record<string, unknown>): void {
        this._snackBar.open(this._transloco.translate(key, params), undefined, {
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
