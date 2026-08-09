import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    applyApiErrorToForm,
    clearServerErrors,
    fieldErrorKey,
    fieldMaxLength,
    serverError,
} from 'app/core/api/form-errors';
import {
    nonBlankValidator,
    trimmedMaxLengthValidator,
} from 'app/core/api/validators';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { CatalogService } from 'app/modules/catalog/catalog.service';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { ORDER_TEXT_MAX_LENGTH } from 'app/modules/orders/orders.validation';
import { RestaurantProfileService } from 'app/modules/restaurant/restaurant-profile.service';
import { ProductCardComponent } from 'app/shared/product-card/product-card.component';
import { ProductCardVm } from 'app/shared/product-card/product-card.types';
import { DateTime } from 'luxon';
import { RestaurantScheduledOrdersService } from './scheduled-orders.service';
import {
    isKnownRecurrence,
    SCHEDULE_RECURRENCE_TYPES,
    ScheduledOrder,
    ScheduledOrderInstance,
} from './scheduled-orders.types';

/** One product the create/edit form's item picker has added to the template. */
interface PickedItem {
    marketProductId: string;
    quantity: number;
    /** `null` when the id came back from an existing schedule but is no longer listed in the currently selected market (delisted/moved). */
    product: CatalogProduct | null;
}

/**
 * Recurring orders (UC-ORD-09/10) — create a daily or weekly schedule, list
 * them, inspect the runs each has produced, edit one, and stop future runs.
 *
 * Pausing is in BR-ORD-5 but has no endpoint (only `.../cancel`), so it is not
 * offered — a control that cannot reach the server would be a lie.
 */
@Component({
    selector: 'scheduled-orders',
    templateUrl: './scheduled-orders.component.html',
    styleUrl: './scheduled-orders.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    // A component-scoped CatalogService instance: the root-provided singleton
    // backs the main catalog page's own `products` signal, and browsing
    // products here for the item picker must not clobber that state (or vice
    // versa) if both are open across tabs/navigation.
    providers: [CatalogService],
    imports: [
        DatePipe,
        DecimalPipe,
        MatButtonModule,
        MatDatepickerModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatSnackBarModule,
        MatTooltipModule,
        NgTemplateOutlet,
        ProductCardComponent,
        ReactiveFormsModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class ScheduledOrdersComponent implements OnInit {
    private readonly _service = inject(RestaurantScheduledOrdersService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _fb = inject(FormBuilder);
    private readonly _catalog = inject(CatalogService);
    private readonly _marketSelection = inject(MarketSelectionService);
    private readonly _restaurantProfile = inject(RestaurantProfileService);

    /** Localized reason the list read failed — drives the retry state. */
    readonly loadError = signal<string | null>(null);
    /** Localized reason the last write failed (409 already cancelled, 422, …). */
    readonly actionError = signal<string | null>(null);
    readonly saving = signal(false);

    /** Template helpers for per-field messages. */
    readonly errorKey = fieldErrorKey;
    readonly maxLength = fieldMaxLength;
    readonly serverMessage = serverError;

    /**
     * Editing a schedule (`PATCH`): frequency, first run and notes — the three
     * fields `UpdateScheduledOrderRequest` accepts. Laid out the way Uber Eats
     * orders its recurring-order settings: when it first runs, then how often.
     *
     * `recurrenceType` is an opaque string in the spec — the vocabulary is not
     * enumerated, so this is free text seeded from the current value rather
     * than a select of options we would have to invent.
     */
    /** Recurrence options, from BR-ORD-5 / FR-ORD-009 (daily or weekly). */
    readonly recurrenceTypes = SCHEDULE_RECURRENCE_TYPES;

    /** `null` = closed, `'new'` = creating, otherwise the id being edited. */
    readonly editingId = signal<string | null>(null);
    /**
     * True while editing an already-saved schedule (not creating). The item
     * picker is read-only in this state — see the comment on `saveEdit()` for
     * why items can't be changed here yet.
     */
    readonly isEditingExisting = computed(() => {
        const id = this.editingId();
        return id !== null && id !== 'new';
    });
    readonly editForm = this._fb.group({
        recurrenceType: this._fb.nonNullable.control('', {
            validators: [Validators.required, nonBlankValidator],
        }),
        // Date uses MatDatepicker (same component as checkout's delivery date, driven by the
        // app-wide Luxon DateAdapter) instead of typing it by hand. Time stays a plain native
        // `<input type="time">` — MatTimepicker's dropdown lists every interval slot in one long
        // scroll, which is worse here than just typing "14:30". Combined into one instant in
        // `_combinedFirstRunAt()`; "must be in the future" is checked there too (in saveEdit),
        // since that check needs both parts together.
        firstRunAtDate: this._fb.control<DateTime | null>(null, {
            validators: [Validators.required],
        }),
        firstRunAtTime: this._fb.nonNullable.control('', {
            validators: [Validators.required],
        }),
        notes: this._fb.nonNullable.control('', {
            validators: [trimmedMaxLengthValidator(ORDER_TEXT_MAX_LENGTH)],
        }),
    });

    /** Floors the datepicker's selectable range — matches the backend's own "must be future" rule. */
    protected readonly minFirstRunDate = DateTime.now().startOf('day');

    readonly loading = signal(true);
    readonly schedules = signal<ScheduledOrder[]>([]);
    readonly includeCancelled = signal(false);

    /** Schedule id whose runs are expanded, plus the runs themselves. */
    readonly expandedId = signal<string | null>(null);
    readonly instances = signal<ScheduledOrderInstance[]>([]);
    readonly instancesLoading = signal(false);

    // ── Item template + delivery address (SCRUM-386) ────────────────────────
    // The item picker is shared between the "create" panel and each card's
    // inline "edit" panel via the `itemPicker` ng-template below, exactly like
    // `editForm` already is — only one of the two panels is ever open at once.

    readonly marketSelected = computed(() =>
        this._marketSelection.hasSelection()
    );
    readonly pickedItems = signal<PickedItem[]>([]);
    /**
     * True while `_hydratePickedItems` is resolving a batch of {marketProductId, quantity}
     * lines (an edited schedule's saved items, or prefillItems from checkout/order-detail).
     * Create-mode save must wait for this — see saveEdit(). The browse/add UI is also locked
     * while true: `_hydratePickedItems` finishes by overwriting `pickedItems` wholesale, so an
     * item added here mid-resolve would just get silently wiped out when it completes.
     */
    readonly resolvingItems = signal(false);
    readonly itemSearchTerm = signal('');
    readonly visibleCount = signal(20);
    readonly catalogLoading = this._catalog.loading;

    /** Loaded market products, filtered by the picker's own search box. */
    readonly filteredPickerProducts = computed(() => {
        const term = this.itemSearchTerm().trim().toLowerCase();
        const items = this._catalog.products();
        if (!term) {
            return items;
        }
        return items.filter(
            (product) =>
                product.name.toLowerCase().includes(term) ||
                product.nameEn.toLowerCase().includes(term)
        );
    });

    readonly visiblePickerProducts = computed(() =>
        this.filteredPickerProducts().slice(0, this.visibleCount())
    );

    readonly catalogHasMore = computed(
        () => this.visibleCount() < this.filteredPickerProducts().length
    );

    /** The restaurant's default saved delivery address, or `null` if none exists yet. */
    readonly defaultAddress = computed(() =>
        this._restaurantProfile.defaultDeliveryAddress()
    );

    async ngOnInit(): Promise<void> {
        await this.reload();
        void this._restaurantProfile.loadDeliveryAddresses();
        await this._marketSelection.ensureLoaded();
        // Awaited (not fire-and-forget) so _consumePrefill below never races it
        await this._catalog.loadMarketListing(
            this._marketSelection.selectedId()
        );
        this._consumePrefill();
    }

    /**
     * One-shot handoff from checkout's or an order's "Đặt định kỳ..." button (Router `state`,
     * not query params — see checkout.component.ts/order-detail.component.ts). Cleared from
     * history state right away so revisiting this route via back/forward doesn't keep
     * re-opening the create form from the same stale items.
     *
     * Resolved against the currently selected market only, same as `_hydratePickedItems` — safe
     * here because shopping (and therefore every order's items) is scoped to one market at a
     * time on this app, unlike the mobile app which allows mixing markets in one order.
     */
    private _consumePrefill(): void {
        const prefill = history.state?.prefillItems as
            | { marketProductId: string; quantity: number }[]
            | undefined;
        if (!prefill || prefill.length === 0) {
            return;
        }
        window.history.replaceState(
            { ...window.history.state, prefillItems: undefined },
            '',
            window.location.href
        );
        this.openCreate();
        void this._hydratePickedItems(prefill);
    }

    /** Adds one unit, or bumps an already-picked line's quantity by one. */
    addPickedItem(product: CatalogProduct): void {
        this.pickedItems.update((items) => {
            const idx = items.findIndex(
                (item) => item.marketProductId === product.marketProductId
            );
            if (idx >= 0) {
                const copy = [...items];
                copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
                return copy;
            }
            return [
                ...items,
                {
                    marketProductId: product.marketProductId,
                    quantity: 1,
                    product,
                },
            ];
        });
    }

    incrementPicked(marketProductId: string): void {
        this.pickedItems.update((items) =>
            items.map((item) =>
                item.marketProductId === marketProductId
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            )
        );
    }

    /** Quantity 1 → removed entirely, same as the cart's own stepper. */
    decrementPicked(marketProductId: string): void {
        this.pickedItems.update((items) =>
            items
                .map((item) =>
                    item.marketProductId === marketProductId
                        ? { ...item, quantity: item.quantity - 1 }
                        : item
                )
                .filter((item) => item.quantity > 0)
        );
    }

    removePicked(marketProductId: string): void {
        this.pickedItems.update((items) =>
            items.filter((item) => item.marketProductId !== marketProductId)
        );
    }

    loadMorePickerProducts(): void {
        this.visibleCount.update((count) => count + 20);
    }

    onSearchTermChange(term: string): void {
        this.itemSearchTerm.set(term);
        this.visibleCount.set(20);
    }

    /** Map a listing onto the shared tile's view model (no favorite action here). */
    productVm(product: CatalogProduct): ProductCardVm {
        return {
            id: product.id,
            name: product.name,
            thumbnail: product.thumbnail,
            imageUrl: product.imageUrl || product.thumbnail,
            price: this._formatPrice(product.price),
            meta: `${product.unit} · ${product.marketSource}`,
            stock: product.quantity,
            stockUnit: product.unit,
            inactive: product.active === false,
        };
    }

    private _formatPrice(price: number | null): string {
        if (price === null) {
            return '—';
        }
        return `${price.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }

    /**
     * Resolves each stored `marketProductId` against the currently selected
     * market's listing so the picked-items list can show a name/price instead
     * of a bare id. A line that no longer resolves (delisted, or belongs to a
     * different market than the one currently selected) renders with `product:
     * null` — kept in the list rather than silently dropped, since removing it
     * would change what gets saved without the user asking for that.
     */
    private async _hydratePickedItems(
        items: { marketProductId: string; quantity: number }[]
    ): Promise<void> {
        if (items.length === 0) {
            this.pickedItems.set([]);
            return;
        }
        this.resolvingItems.set(true);
        try {
            if (this._catalog.products().length === 0) {
                await this._catalog.loadMarketListing(
                    this._marketSelection.selectedId()
                );
            }
            const byId = new Map(
                this._catalog
                    .products()
                    .map((product) => [product.marketProductId, product])
            );
            this.pickedItems.set(
                items.map((item) => ({
                    marketProductId: item.marketProductId,
                    quantity: item.quantity,
                    product: byId.get(item.marketProductId) ?? null,
                }))
            );
        } finally {
            this.resolvingItems.set(false);
        }
    }

    async reload(): Promise<void> {
        this.loading.set(true);
        this.loadError.set(null);
        try {
            const { items } = await this._service.listScheduled(
                1,
                this.includeCancelled()
            );
            this.schedules.set(items);
        } catch (err) {
            // A failed read is not "no schedules" — say which it is.
            this.schedules.set([]);
            this.loadError.set(
                await this._describe(err, 'scheduledOrders.loadError')
            );
        } finally {
            this.loading.set(false);
        }
    }

    async toggleCancelled(include: boolean): Promise<void> {
        this.includeCancelled.set(include);
        await this.reload();
    }

    /** Expand a schedule to show the orders it has generated. */
    async toggleInstances(schedule: ScheduledOrder): Promise<void> {
        if (this.expandedId() === schedule.id) {
            this.expandedId.set(null);
            return;
        }

        this.expandedId.set(schedule.id);
        this.instances.set([]);
        this.instancesLoading.set(true);
        try {
            const { items } = await this._service.listInstances(schedule.id);
            this.instances.set(items);
        } catch (err) {
            this.instances.set([]);
            this.actionError.set(
                await this._describe(err, 'scheduledOrders.instancesError')
            );
        } finally {
            this.instancesLoading.set(false);
        }
    }

    async cancel(schedule: ScheduledOrder): Promise<void> {
        try {
            await this._service.cancelScheduled(schedule.id);
            this._snackBar.open(
                this._transloco.translate('scheduledOrders.cancelled'),
                undefined,
                { duration: 3000 }
            );
            await this.reload();
        } catch (error) {
            // 409 = already cancelled, 404 = gone, 403 = not yours: each gets
            // its own wording, and the list re-reads so it stops showing a
            // schedule the backend no longer has.
            const message = await this._describe(
                error,
                'scheduledOrders.cancelError'
            );
            this.actionError.set(message);
            this._snackBar.open(message, undefined, { duration: 5000 });
            await this.reload();
        }
    }

    /** Opens the form blank to create a new schedule (UC-ORD-09). */
    openCreate(): void {
        this.editingId.set('new');
        this.actionError.set(null);
        clearServerErrors(this.editForm);
        this.editForm.reset({
            recurrenceType: SCHEDULE_RECURRENCE_TYPES[0],
            firstRunAtDate: null,
            firstRunAtTime: '',
            notes: '',
        });
        this.pickedItems.set([]);
        this.itemSearchTerm.set('');
    }

    /** True while the form is creating rather than editing. */
    isCreating(): boolean {
        return this.editingId() === 'new';
    }

    /** Opens the edit form seeded from the schedule's current values. */
    openEdit(schedule: ScheduledOrder): void {
        this.editingId.set(schedule.id);
        this.actionError.set(null);
        clearServerErrors(this.editForm);
        // Both pickers seed from the same instant — one shows its date part, the other its
        // time part, same as assigning one Luxon DateTime to two independent controls.
        const seedAt = toDateTime(schedule.nextRunAt ?? schedule.firstRunAt);
        this.editForm.reset({
            // A schedule saved with a value outside the documented vocabulary
            // must not be silently rewritten — leave the select unset instead.
            recurrenceType: isKnownRecurrence(schedule.recurrenceType)
                ? schedule.recurrenceType.toUpperCase()
                : '',
            firstRunAtDate: seedAt,
            firstRunAtTime: seedAt ? seedAt.toFormat('HH:mm') : '',
            notes: schedule.notes ?? '',
        });
        this.itemSearchTerm.set('');
        void this._hydratePickedItems(schedule.items ?? []);
    }

    closeEdit(): void {
        this.editingId.set(null);
    }

    /** Merges the date picker's day with the typed "HH:mm" time into one instant. */
    private _combinedFirstRunAt(): DateTime | null {
        const { firstRunAtDate, firstRunAtTime } = this.editForm.getRawValue();
        if (!firstRunAtDate || !firstRunAtTime) {
            return null;
        }
        const [hour, minute] = firstRunAtTime.split(':').map(Number);
        if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
            return null;
        }
        return firstRunAtDate.set({ hour, minute, second: 0, millisecond: 0 });
    }

    /** Persists the edit — recurrence/notes plus the item template and delivery address. */
    async saveEdit(): Promise<void> {
        const id = this.editingId();
        if (!id || this.saving()) {
            return;
        }
        clearServerErrors(this.editForm);
        this.actionError.set(null);
        if (this.editForm.invalid) {
            this.editForm.markAllAsTouched();
            return;
        }
        const address = this.defaultAddress();
        const isCreate = id === 'new';
        // Create always sets firstRunAt; editing only re-validates/resends it if the user
        // actually touched one of the two pickers. An active schedule's seeded value is normally
        // already in the past by design (it already started running — `nextRunAt` never
        // populates from the real API, so the form always seeds from `firstRunAt` itself), so
        // requiring it to be in the future on every save would make it impossible to edit
        // notes/recurrence on any schedule that has ever run. Angular's own `dirty` flag (set by
        // the pickers' value accessors on user interaction, untouched by the programmatic
        // `reset()` in openEdit) is exactly "did the user change this" — no separate flag needed.
        const firstRunAtTouched =
            isCreate ||
            this.editForm.controls.firstRunAtDate.dirty ||
            this.editForm.controls.firstRunAtTime.dirty;
        let firstRunAt: DateTime | null = null;
        if (firstRunAtTouched) {
            // Combining needs both pickers together, so "must be in the future" can't live on
            // either control's own validators — it has to be checked here instead.
            firstRunAt = this._combinedFirstRunAt();
            if (!firstRunAt || firstRunAt.toMillis() <= Date.now()) {
                this.actionError.set(
                    this._transloco.translate('scheduledOrders.firstRunPast')
                );
                return;
            }
        }
        // Items are create-only for now: sending `items` on update re-triggers the backend's
        // item-template replacement path, which currently 409s (ScheduledOrderRepository.Track
        // marks the freshly-replaced items Modified instead of Added, so the UPDATE matches 0
        // rows). Until that's fixed server-side, the picker is read-only once editing an existing
        // schedule (see the template), so this only needs to gate the create path.
        if (isCreate && this.resolvingItems()) {
            this.actionError.set(
                this._transloco.translate('scheduledOrders.itemsResolving')
            );
            return;
        }
        if (!address || (isCreate && this.pickedItems().length === 0)) {
            this.actionError.set(
                this._transloco.translate('scheduledOrders.itemsRequired')
            );
            return;
        }
        const v = this.editForm.getRawValue();
        this.saving.set(true);
        try {
            if (isCreate) {
                // firstRunAt is guaranteed non-null here: isCreate implies firstRunAtTouched,
                // and a null/past combined value already returned above.
                await this._service.createScheduled({
                    recurrenceType: v.recurrenceType.trim(),
                    firstRunAt: firstRunAt!.toJSDate(),
                    notes: v.notes.trim() || null,
                    deliveryAddressId: address.id,
                    items: this.pickedItems().map((item) => ({
                        marketProductId: item.marketProductId,
                        quantity: item.quantity,
                    })),
                });
            } else {
                await this._service.updateScheduled(id, {
                    recurrenceType: v.recurrenceType.trim(),
                    // Omitted (not resent as an already-past value) unless the user touched a
                    // picker — matches UpdateScheduledOrderCommandHandler's "only validate what
                    // was sent" semantics.
                    firstRunAt: firstRunAt ? firstRunAt.toJSDate() : undefined,
                    notes: v.notes.trim() || null,
                    deliveryAddressId: address.id,
                    // `items` deliberately omitted — see the comment above.
                });
            }
            this._snackBar.open(
                this._transloco.translate(
                    id === 'new'
                        ? 'scheduledOrders.created'
                        : 'scheduledOrders.saved'
                ),
                undefined,
                { duration: 3000 }
            );
            this.editingId.set(null);
            await this.reload();
        } catch (err) {
            const translate = (key: string): string =>
                this._transloco.translate(key);
            const { handled } = await applyApiErrorToForm(
                this.editForm,
                err,
                translate
            );
            this.actionError.set(
                handled
                    ? translate('errors.api.validation')
                    : await this._describe(
                          err,
                          id === 'new'
                              ? 'scheduledOrders.createError'
                              : 'scheduledOrders.saveError'
                      )
            );
        } finally {
            this.saving.set(false);
        }
    }

    private _describe(err: unknown, fallbackKey: string): Promise<string> {
        return describeApiError(
            err,
            (key) => this._transloco.translate(key),
            fallbackKey
        );
    }

    /** A schedule with a cancellation date no longer produces runs. */
    isCancelled(schedule: ScheduledOrder): boolean {
        return (
            !!schedule.cancelledAt ||
            (schedule.status ?? '').toLowerCase() === 'cancelled'
        );
    }

    /** i18n key for a schedule's recurrence label (falls back to generic title). */
    recurrenceKey(schedule: ScheduledOrder): string {
        const raw = (schedule.recurrenceType ?? '').toUpperCase();
        return isKnownRecurrence(raw)
            ? `scheduledOrders.recurrence.${raw}`
            : 'scheduledOrders.schedule';
    }
}

/** ISO instant → a Luxon `DateTime` for the date/time pickers, or `null` if unparseable. */
function toDateTime(value: string | null | undefined): DateTime | null {
    if (!value) {
        return null;
    }
    const parsed = DateTime.fromISO(value);
    return parsed.isValid ? parsed : null;
}
