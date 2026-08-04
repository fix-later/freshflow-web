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
import { CrudOption } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';
import {
    OPTIMIZATION_CRITERIA,
    OptimizationCriterion,
    RouteSuggestionItem,
} from './logistics-admin.types';

/** Backend guard: a route may not contain more than 20 stops (BR — LOG). */
const MAX_STOPS = 20;

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

    readonly serviceDate = new FormControl<DateTime | null>(DateTime.now());
    readonly criteria = new FormControl<OptimizationCriterion>('cost', {
        nonNullable: true,
    });
    readonly includeBatched = new FormControl(false, { nonNullable: true });
    readonly hubId = new FormControl('', { nonNullable: true });

    readonly hubs = signal<CrudOption[]>([]);
    readonly restaurants = signal<RouteSuggestionItem[]>([]);
    readonly selectedRestaurants = signal<Set<string>>(new Set());

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
            !!this.hubId.value &&
            this.selectedRestaurants().size > 0 &&
            !this.tooManyStops() &&
            !this.busy()
    );
    readonly canPlan = computed(() => !!this.hubId.value && !this.busy());

    ngOnInit(): void {
        void this._logistics.hubOptions().then((options) => {
            this.hubs.set(options);
            if (!this.hubId.value && options.length) {
                this.hubId.setValue(options[0].value);
            }
        });
        this._loadSuggestions();
        this.serviceDate.valueChanges.subscribe(() => this._loadSuggestions());
        this.includeBatched.valueChanges.subscribe(() =>
            this._loadSuggestions()
        );
    }

    goBack(): void {
        void this._router.navigate(['/admin/routes']);
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

    /** Lets the backend build every route the hub needs for the day. */
    plan(): void {
        const isoDate = this._isoDate();
        if (!isoDate || !this.canPlan()) {
            return;
        }
        this.planning.set(true);
        void this._logistics
            .planRoutes({
                hubId: this.hubId.value,
                serviceDate: isoDate,
                optimizationCriteria: this.criteria.value,
            })
            .then((routes) => {
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
                this._preselect(suggestions.restaurants);
            })
            .catch(() => {
                this.restaurants.set([]);
                this.selectedRestaurants.set(new Set());
            })
            .finally(() => this.loading.set(false));
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
