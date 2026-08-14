import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    TemplateRef,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import {
    AbstractControl,
    FormBuilder,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { readApiError } from 'app/core/api/envelope';
import { describeApiError } from 'app/core/api/error-codes';
import { includesFolded } from 'app/core/util/text-search';
import { DateTime } from 'luxon';
import { AdminService } from '../admin.service';
import {
    AdminAutoBatchBatch,
    AdminAutoBatchResult,
    AdminBatchItem,
    AdminBatchMember,
    AdminOrderDetail,
    AdminOrderGroupProgress,
    AdminOrderGroupRow,
    AdminUserRow,
} from '../admin.types';
import { CatalogAdminService } from '../catalog/catalog-admin.service';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { ADMIN_DEFAULT_PAGE_SIZE } from '../shared/admin-pagination';
import { CoalescedTask } from '../shared/coalesced-task';
import { TableSort } from '../shared/table-sort';
import { statusLabelKey, statusPillClass } from './order-group-status';

/**
 * Reasons the run reports for doing nothing (`{"skipped":true,"reason":…}`).
 * Verified live: a run with nothing to group answers `no_eligible_orders`.
 * Anything unlisted falls back to the raw code rather than an empty banner.
 */
const KNOWN_SKIP_REASONS = new Set([
    'no_eligible_orders',
    'already_batched',
    'batching_disabled',
    'outside_window',
]);

const VIETNAM_ZONE = 'Asia/Ho_Chi_Minh';

interface PlanningDay {
    iso: string;
    date: DateTime;
    pendingOrders: number;
    existingSessions: number;
}

/** Optional Luxon day from the Material datepicker. */
function validTargetDate(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (value == null || value === '') {
        return null;
    }
    return DateTime.isDateTime(value) && value.isValid
        ? null
        : { invalidDate: true };
}

/**
 * Admin ▸ Order groups — Fuse inventory list of procurement batches with
 * auto-batch / manifest / agent / cancel actions.
 */
@Component({
    selector: 'admin-order-groups',
    templateUrl: './order-groups.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatDatepickerModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatCheckboxModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
    styles: [
        `
            .order-groups-grid {
                /* market | status | agent | actions */
                grid-template-columns:
                    minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 1.2fr)
                    3.5rem;

                @screen md {
                    /* delivery date | market | status | orders | agent | actions */
                    grid-template-columns:
                        minmax(8.5rem, 0.85fr) minmax(0, 1fr)
                        minmax(0, 0.85fr) minmax(0, 0.5fr)
                        minmax(0, 1.3fr) 3.5rem;
                }
            }

            .planning-day-card {
                min-width: 10.5rem;
                transition:
                    border-color 160ms ease,
                    background-color 160ms ease,
                    transform 160ms ease;
            }

            .planning-day-card:hover {
                transform: translateY(-1px);
            }

            .history-groups-grid {
                grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.75fr) 3.5rem;

                @screen md {
                    grid-template-columns:
                        8.5rem minmax(0, 1.2fr) minmax(0, 0.75fr)
                        minmax(8rem, 0.85fr) 3.5rem;
                }

                @screen lg {
                    grid-template-columns:
                        8.5rem minmax(0, 1.15fr) minmax(0, 0.75fr)
                        minmax(8rem, 0.85fr) minmax(0, 1.2fr) 3.5rem;
                }
            }
        `,
    ],
})
export class OrderGroupsComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _dialog = inject(MatDialog);
    private readonly _router = inject(Router);
    private readonly _route = inject(ActivatedRoute);

    readonly historyView = this._route.snapshot.data['view'] === 'history';

    readonly statusPillClass = statusPillClass;

    private _batchDialogRef: MatDialogRef<unknown> | null = null;
    private _resetDialogRef: MatDialogRef<unknown> | null = null;
    private _agentDialogRef: MatDialogRef<unknown> | null = null;
    private _orderDialogRef: MatDialogRef<unknown> | null = null;

    readonly groups = signal<AdminOrderGroupRow[]>([]);
    readonly agents = signal<AdminUserRow[]>([]);
    readonly markets = signal<{ id: string; name: string }[]>([]);
    readonly totalCount = signal(0);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly loading = signal(false);
    readonly pendingOrders = signal<AdminOrderDetail[]>([]);
    readonly historyOrderDetails = signal<Map<string, AdminOrderDetail>>(
        new Map()
    );
    readonly historySummaryLoading = signal(false);
    readonly planningLoading = signal(false);
    readonly planningApplying = signal(false);

    private readonly _localToday = DateTime.now()
        .setZone(VIETNAM_ZONE)
        .startOf('day');
    readonly tomorrowDate = this._localToday.plus({ days: 1 });
    readonly planningDate = signal<DateTime>(this.tomorrowDate);
    readonly planningResult = signal<AdminAutoBatchResult | null>(null);
    readonly planningRestaurantNames = signal<Map<string, string>>(new Map());

    /** Order selected from a proposed/existing session. */
    readonly planningOrder = signal<AdminOrderDetail | null>(null);
    readonly planningOrderId = signal('');
    readonly planningOrderRestaurant = signal('');
    readonly planningOrderLoading = signal(false);
    readonly planningOrderError = signal(false);
    readonly planningOrderUnits = signal<Map<string, string>>(new Map());
    private readonly _marketUnitCache = new Map<
        string,
        Promise<Map<string, string>>
    >();

    /**
     * Server-side batching progress (`GET /admin/order-groups/progress`).
     * The table lists the batches; this says how far the run itself has got,
     * which is the question an operator has while it is still running.
     */
    readonly progress = signal<AdminOrderGroupProgress | null>(null);

    /** The run's own figures, or `null` when the endpoint reports no run. */
    readonly progressSummary = computed(() => this.progress()?.summary ?? null);

    /**
     * Items purchased as a percentage of items in the run. The endpoint counts
     * **items**, not batches — a batch sits at "Built" for as long as it takes
     * its agent to buy every line, so batch counts barely move while the run
     * is actually progressing.
     */
    readonly progressPercent = computed(() => {
        const s = this.progressSummary();
        const total = Number(s?.totalItems ?? 0);
        if (!total) {
            return null;
        }
        return Math.round((Number(s?.itemsPurchased ?? 0) / total) * 100);
    });

    /** Exceptions still open across the run — the number that needs an owner. */
    readonly openExceptions = computed(() =>
        Number(this.progressSummary()?.openExceptions ?? 0)
    );

    readonly activeSessionCount = computed(
        () =>
            this.groups().filter(
                (group) =>
                    !['completed', 'cancelled'].includes(
                        String(group.status ?? '').toLowerCase()
                    )
            ).length
    );

    readonly unassignedSessionCount = computed(
        () =>
            this.groups().filter(
                (group) =>
                    !['completed', 'cancelled'].includes(
                        String(group.status ?? '').toLowerCase()
                    ) && !group.agentId
            ).length
    );

    /** Delivery dates that restaurants actually have confirmed orders for. */
    readonly planningDays = computed<PlanningDay[]>(() => {
        const pendingByDate = new Map<string, number>();
        for (const order of this.pendingOrders()) {
            const iso = this._deliveryDateIso(order.scheduledFor);
            if (iso) {
                pendingByDate.set(iso, (pendingByDate.get(iso) ?? 0) + 1);
            }
        }

        const sessionsByDate = new Map<string, number>();
        for (const group of this.groups()) {
            if (String(group.status ?? '').toLowerCase() === 'cancelled') {
                continue;
            }
            const iso = this.sessionDateIso(group);
            if (iso) {
                sessionsByDate.set(iso, (sessionsByDate.get(iso) ?? 0) + 1);
            }
        }

        const dates = new Set<string>();
        const tomorrowIso = this.tomorrowDate.toISODate();
        if (tomorrowIso) {
            dates.add(tomorrowIso);
        }
        for (const iso of pendingByDate.keys()) {
            const day = DateTime.fromISO(iso, { zone: VIETNAM_ZONE });
            if (day.isValid && day >= this.tomorrowDate) {
                dates.add(iso);
            }
        }
        for (const iso of sessionsByDate.keys()) {
            const day = DateTime.fromISO(iso, { zone: VIETNAM_ZONE });
            if (day.isValid && day >= this.tomorrowDate) {
                dates.add(iso);
            }
        }

        return [...dates]
            .sort()
            .slice(0, 7)
            .map((iso) => ({
                iso,
                date: DateTime.fromISO(iso, { zone: VIETNAM_ZONE }),
                pendingOrders: pendingByDate.get(iso) ?? 0,
                existingSessions: sessionsByDate.get(iso) ?? 0,
            }));
    });

    readonly selectedPlanningIso = computed(
        () => this.planningDate().toISODate() ?? ''
    );

    readonly selectedPlanningDay = computed(() =>
        this.planningDays().find(
            (day) => day.iso === this.selectedPlanningIso()
        )
    );

    readonly selectedPendingOrders = computed(() =>
        this.pendingOrders().filter(
            (order) =>
                this._deliveryDateIso(order.scheduledFor) ===
                this.selectedPlanningIso()
        )
    );

    readonly selectedExistingSessions = computed(() =>
        this.groups().filter(
            (group) =>
                this.sessionDateIso(group) === this.selectedPlanningIso() &&
                String(group.status ?? '').toLowerCase() !== 'cancelled'
        )
    );

    readonly existingOrderCount = computed(() =>
        this.selectedExistingSessions().reduce(
            (sum, group) => sum + this.membersOf(group).length,
            0
        )
    );

    readonly canCreatePlannedSessions = computed(
        () =>
            !this.planningLoading() &&
            !this.planningApplying() &&
            !!this.planningResult()?.preview?.length &&
            !this.planningResult()?.skipped
    );
    readonly batching = signal(false);
    readonly resetting = signal(false);
    readonly search = signal('');
    /** Inclusive client-side date range on `createdAt` / batch date. */
    readonly dateFrom = signal<DateTime | null>(null);
    readonly dateTo = signal<DateTime | null>(null);
    /** Empty string = all. */
    readonly statusFilter = signal('');
    readonly marketFilter = signal('');
    readonly agentFilter = signal('');

    /** Batch lifecycle statuses for the status filter. */
    readonly statusOptions = [
        'Built',
        'Manifested',
        'Purchasing',
        'HandedOff',
        'Completed',
        'Cancelled',
    ] as const;

    /** Structured result of the last auto-batch run (dry or applied). */
    readonly autoBatchResult = signal<AdminAutoBatchResult | null>(null);
    /** Explained failure of the last auto-batch run, shown as a banner. */
    readonly autoBatchError = signal<{
        message: string;
        severity: 'error' | 'warning';
    } | null>(null);

    /** Row targeted by the assign-agent dialog. */
    readonly agentDialogBatch = signal<AdminOrderGroupRow | null>(null);
    readonly agentDialogSaving = signal(false);
    readonly agentForm = new FormGroup({
        agentUserId: new FormControl('', { nonNullable: true }),
    });

    readonly sort = new TableSort<AdminOrderGroupRow>();

    readonly filteredGroups = computed(() => {
        const term = this.search().trim();
        const from = this.dateFrom();
        const to = this.dateTo();
        const status = this.statusFilter().trim().toLowerCase();
        const marketId = this.marketFilter().trim();
        const agentId = this.agentFilter().trim();
        const fromDay =
            from && DateTime.isDateTime(from) && from.isValid
                ? from.startOf('day')
                : null;
        const toDay =
            to && DateTime.isDateTime(to) && to.isValid
                ? to.startOf('day')
                : null;

        return this.groups().filter((group) => {
            if (
                this.historyView &&
                (group['isCompleted'] !== true ||
                    String(group.status ?? '').toLowerCase() === 'cancelled')
            ) {
                return false;
            }
            if (status) {
                if (String(group.status ?? '').toLowerCase() !== status) {
                    return false;
                }
            }
            if (marketId) {
                if (String(group.marketId ?? '') !== marketId) {
                    return false;
                }
            }
            if (agentId) {
                const assigned =
                    group.agentId ??
                    (group['assignedAgentUserId'] as string | null) ??
                    '';
                if (String(assigned) !== agentId) {
                    return false;
                }
            }
            if (fromDay || toDay) {
                const day = this._batchDay(group);
                if (!day) {
                    return false;
                }
                if (fromDay && day < fromDay) {
                    return false;
                }
                if (toDay && day > toDay) {
                    return false;
                }
            }
            if (!term) {
                return true;
            }
            const agent = this.agentFor(group);
            const agentText = agent
                ? `${agent.email ?? ''} ${String(agent['name'] ?? '')}`
                : String(group.agentEmail ?? '');
            return (
                includesFolded(String(group.marketName ?? ''), term) ||
                includesFolded(agentText, term) ||
                includesFolded(this.statusLabel(group.status), term)
            );
        });
    });

    readonly hasActiveFilters = computed(
        () =>
            !!this.search().trim() ||
            !!this.dateFrom() ||
            !!this.dateTo() ||
            !!this.statusFilter() ||
            !!this.marketFilter() ||
            !!this.agentFilter()
    );

    readonly sortedGroups = computed(() =>
        this.sort.apply(
            this.filteredGroups(),
            (group, key) => group[key] as string | number | null
        )
    );

    /** Client-side page slice — search/filters run over the full loaded set. */
    readonly pagedGroups = computed(() => {
        const rows = this.sortedGroups();
        const start = this.pageIndex() * this.pageSize();
        return rows.slice(start, start + this.pageSize());
    });

    readonly filteredTotal = computed(() => this.filteredGroups().length);

    readonly historyMarketCount = computed(
        () =>
            new Set(
                this.filteredGroups()
                    .map((group) => String(group.marketId ?? ''))
                    .filter(Boolean)
            ).size
    );

    readonly historyOrderCount = computed(() => {
        const ids = new Set<string>();
        for (const group of this.filteredGroups()) {
            for (const member of this.membersOf(group)) {
                const id = String(member.orderId ?? '');
                if (id) {
                    ids.add(id);
                }
            }
        }
        return ids.size;
    });

    readonly historyItemCount = computed(() =>
        this.filteredGroups().reduce(
            (sum, group) =>
                sum +
                Number(
                    group.itemCount ??
                        group['totalItemCount'] ??
                        (Array.isArray(group['items'])
                            ? group['items'].length
                            : 0)
                ),
            0
        )
    );

    readonly historyInvoiceTotal = computed(() => {
        const ids = new Set<string>();
        for (const group of this.filteredGroups()) {
            for (const member of this.membersOf(group)) {
                const id = String(member.orderId ?? '');
                if (id) {
                    ids.add(id);
                }
            }
        }
        return [...ids].reduce(
            (sum, id) =>
                sum +
                Number(this.historyOrderDetails().get(id)?.totalAmount ?? 0),
            0
        );
    });

    readonly batchForm = this._formBuilder.group({
        targetDate: this._formBuilder.control<DateTime | null>(
            this.tomorrowDate,
            {
                validators: [Validators.required, validTargetDate],
            }
        ),
        dryRun: this._formBuilder.nonNullable.control(true),
        force: this._formBuilder.nonNullable.control(false),
    });

    /**
     * Reset form. `confirmation` is whatever phrase the backend demands —
     * it's forwarded verbatim, so a wrong one fails server-side rather than
     * being second-guessed here.
     */
    readonly resetForm = this._formBuilder.group({
        targetDate: this._formBuilder.control<DateTime | null>(
            this.tomorrowDate,
            {
                validators: [Validators.required, validTargetDate],
            }
        ),
        confirmation: this._formBuilder.nonNullable.control('', {
            validators: [Validators.required],
        }),
    });

    ngOnInit(): void {
        this._load();
        void Promise.all([
            this._admin
                .getAgentOptions()
                .then((agents) => this.agents.set(agents))
                .catch(() => this.agents.set([])),
            this._admin
                .getMarkets()
                .then((markets) =>
                    this.markets.set(
                        markets.map((m) => ({
                            id: String(m.id),
                            name: String(m.name ?? m.id),
                        }))
                    )
                )
                .catch(() => this.markets.set([])),
        ]).finally(() => {
            if (!this.historyView) {
                this._loadPlanning();
            }
        });
    }

    openHistory(): void {
        void this._router.navigate(['/admin/order-groups/history']);
    }

    openPlanning(): void {
        void this._router.navigate(['/admin/order-groups']);
    }

    selectPlanningDay(day: PlanningDay): void {
        if (this.planningLoading() || this.planningApplying()) {
            return;
        }
        this.planningDate.set(day.date);
        this.batchForm.patchValue({ targetDate: day.date, dryRun: true });
        this.previewPlanningDay();
    }

    previewPlanningDay(): void {
        const targetDate = this.selectedPlanningIso();
        if (!targetDate) {
            return;
        }
        this.planningLoading.set(true);
        this.planningResult.set(null);
        this.autoBatchError.set(null);
        this._admin
            .runAutoBatch({ targetDate, dryRun: true, force: false })
            .then((result) => this.planningResult.set(result))
            .catch((err) => void this._handleAutoBatchError(err))
            .finally(() => this.planningLoading.set(false));
    }

    createPlannedSessions(): void {
        const targetDate = this.selectedPlanningIso();
        if (!targetDate || !this.canCreatePlannedSessions()) {
            return;
        }
        this.planningApplying.set(true);
        this.autoBatchError.set(null);
        this._admin
            .runAutoBatch({ targetDate, dryRun: false, force: false })
            .then((result) => {
                this.planningResult.set(result);
                this._notifyKey('admin.orderGroups.autoBatch.success');
                this.dateFrom.set(this.planningDate());
                this.dateTo.set(this.planningDate());
                this.pageIndex.set(0);
                this._load();
                this._loadPlanning();
            })
            .catch((err) => void this._handleAutoBatchError(err))
            .finally(() => this.planningApplying.set(false));
    }

    planningDayLabel(day: PlanningDay): string {
        if (day.iso === this.tomorrowDate.toISODate()) {
            return this._transloco.translate(
                'admin.orderGroups.planning.tomorrow'
            );
        }
        return day.date
            .setLocale(this._transloco.getActiveLang())
            .toFormat('cccc');
    }

    formatPlanningDate(date: DateTime): string {
        return date.setLocale(this._transloco.getActiveLang()).toLocaleString({
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    }

    /** Orders represented by one dry-run session, preserving backend order. */
    previewOrders(session: AdminAutoBatchBatch): AdminOrderDetail[] {
        const byId = new Map(
            this.pendingOrders().map((order) => [String(order.orderId), order])
        );
        return (session.coveredOrderIds ?? [])
            .map((id) => byId.get(String(id)))
            .filter((order): order is AdminOrderDetail => !!order);
    }

    membersOf(row: AdminOrderGroupRow): AdminBatchMember[] {
        return Array.isArray(row['members'])
            ? (row['members'] as AdminBatchMember[])
            : [];
    }

    planningRestaurantLabel(order: AdminOrderDetail): string {
        const restaurantId = String(order.restaurantId ?? '');
        return (
            this.planningRestaurantNames().get(restaurantId) ||
            this._transloco.translate(
                'admin.orderGroups.planning.restaurantFallback'
            )
        );
    }

    shortOrderId(value: string | null | undefined): string {
        const id = String(value ?? '');
        return id ? id.slice(0, 8).toUpperCase() : '—';
    }

    openPlanningOrder(
        orderId: string | null | undefined,
        marketId: string | null | undefined,
        template: TemplateRef<unknown>
    ): void {
        const id = String(orderId ?? '');
        if (!id || this._orderDialogRef) {
            return;
        }

        this.planningOrderId.set(id);
        this.planningOrder.set(null);
        this.planningOrderRestaurant.set('');
        this.planningOrderUnits.set(new Map());
        this.planningOrderError.set(false);
        this.planningOrderLoading.set(true);
        this._orderDialogRef = this._dialog.open(template, {
            autoFocus: false,
            maxWidth: '96vw',
            width: '760px',
        });
        this._orderDialogRef.afterClosed().subscribe(() => {
            this._orderDialogRef = null;
            this.planningOrderLoading.set(false);
        });

        const marketKey = String(marketId ?? '');
        Promise.all([
            this._admin.getOrder(id),
            marketKey
                ? this._marketUnits(marketKey).catch(
                      () => new Map<string, string>()
                  )
                : Promise.resolve(new Map<string, string>()),
        ])
            .then(async ([order, units]) => {
                if (!order) {
                    throw new Error('ORDER_NOT_FOUND');
                }
                this.planningOrder.set(order);
                this.planningOrderUnits.set(units);
                const restaurantId = String(order.restaurantId ?? '');
                if (restaurantId) {
                    const profile = await this._admin
                        .getRestaurantProfile(restaurantId)
                        .catch(() => null);
                    this.planningOrderRestaurant.set(
                        String(profile?.name ?? restaurantId)
                    );
                }
            })
            .catch(() => this.planningOrderError.set(true))
            .finally(() => this.planningOrderLoading.set(false));
    }

    closePlanningOrder(): void {
        this._orderDialogRef?.close();
    }

    orderItemUnit(marketProductId: string | null | undefined): string {
        return (
            this.planningOrderUnits().get(String(marketProductId ?? '')) ||
            this._transloco.translate(
                'admin.orderGroups.planning.orderDialog.unitFallback'
            )
        );
    }

    money(value: number | null | undefined): string {
        if (value === null || value === undefined) {
            return '—';
        }
        return new Intl.NumberFormat(this._transloco.getActiveLang(), {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(value);
    }

    private _marketUnits(marketId: string): Promise<Map<string, string>> {
        let pending = this._marketUnitCache.get(marketId);
        if (!pending) {
            pending = this._catalog.listMarketProducts(marketId).then(
                (rows) =>
                    new Map(
                        rows.map((row) => {
                            const sellingUnit = (row['sellingUnit'] ??
                                {}) as Record<string, unknown>;
                            return [
                                String(row['marketProductId'] ?? row.id ?? ''),
                                String(
                                    row['unit'] ?? sellingUnit['unitName'] ?? ''
                                ),
                            ];
                        })
                    )
            );
            this._marketUnitCache.set(marketId, pending);
        }
        return pending;
    }

    onSearch(value: string): void {
        this.search.set(value);
        this.pageIndex.set(0);
    }

    onDateFromChange(value: DateTime | null): void {
        this.dateFrom.set(
            value && DateTime.isDateTime(value) && value.isValid ? value : null
        );
        this.pageIndex.set(0);
    }

    onDateToChange(value: DateTime | null): void {
        this.dateTo.set(
            value && DateTime.isDateTime(value) && value.isValid ? value : null
        );
        this.pageIndex.set(0);
    }

    onStatusFilterChange(value: string): void {
        this.statusFilter.set(value ?? '');
        this.pageIndex.set(0);
    }

    onMarketFilterChange(value: string): void {
        this.marketFilter.set(value ?? '');
        this.pageIndex.set(0);
    }

    onAgentFilterChange(value: string): void {
        this.agentFilter.set(value ?? '');
        this.pageIndex.set(0);
    }

    clearFilters(): void {
        this.search.set('');
        this.dateFrom.set(null);
        this.dateTo.set(null);
        this.statusFilter.set('');
        this.marketFilter.set('');
        this.agentFilter.set('');
        this.pageIndex.set(0);
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
    }

    trackById(index: number, row: AdminOrderGroupRow): string {
        return this.batchIdOf(row) || String(index);
    }

    batchIdOf(row: AdminOrderGroupRow): string {
        return row.id ?? '';
    }

    sessionCode(row: AdminOrderGroupRow): string {
        const code = String(row.batchNumber ?? '').trim();
        return code || this.shortOrderId(this.batchIdOf(row));
    }

    historyGroupInvoice(row: AdminOrderGroupRow): number {
        return this.membersOf(row).reduce(
            (sum, member) =>
                sum +
                Number(
                    this.historyOrderDetails().get(String(member.orderId ?? ''))
                        ?.totalAmount ?? 0
                ),
            0
        );
    }

    historyGroupRestaurantCount(row: AdminOrderGroupRow): number {
        return new Set(
            this.membersOf(row)
                .map((member) =>
                    String(
                        this.historyOrderDetails().get(
                            String(member.orderId ?? '')
                        )?.restaurantId ?? ''
                    )
                )
                .filter(Boolean)
        ).size;
    }

    historyGroupItemCount(row: AdminOrderGroupRow): number {
        return Number(
            row.itemCount ??
                row['totalItemCount'] ??
                (Array.isArray(row['items']) ? row['items'].length : 0)
        );
    }

    historyMoney(value: number): string {
        return new Intl.NumberFormat(this._transloco.getActiveLang(), {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(value);
    }

    /** Opens the full-detail page for a batch, passing the row for instant render. */
    openDetail(row: AdminOrderGroupRow): void {
        const id = this.batchIdOf(row);
        if (!id) {
            return;
        }
        this._router.navigate(['/admin/order-groups', id], {
            state: { batch: row },
        });
    }

    // ---- Auto-batch -------------------------------------------------------

    openAutoBatch(template: TemplateRef<unknown>): void {
        if (this._batchDialogRef) {
            return;
        }
        this.autoBatchError.set(null);
        this.batchForm.reset({
            targetDate: this.planningDate(),
            dryRun: true,
            force: false,
        });
        this._batchDialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._batchDialogRef.afterClosed().subscribe(() => {
            this._batchDialogRef = null;
        });
    }

    closeAutoBatch(): void {
        this._batchDialogRef?.close();
    }

    runAutoBatch(): void {
        if (this.batchForm.invalid) {
            this.batchForm.markAllAsTouched();
            return;
        }
        const { targetDate, dryRun, force } = this.batchForm.getRawValue();
        const dateIso =
            targetDate && DateTime.isDateTime(targetDate) && targetDate.isValid
                ? targetDate.toISODate()
                : null;
        this.batching.set(true);
        this.autoBatchResult.set(null);
        this.autoBatchError.set(null);
        this._admin
            .runAutoBatch({
                targetDate: dateIso,
                dryRun: dryRun ?? true,
                force: force ?? false,
            })
            .then((result) => {
                this.autoBatchResult.set(result);
                this.closeAutoBatch();
                if (!dryRun) {
                    this._notifyKey('admin.orderGroups.autoBatch.success');
                    this._load();
                }
            })
            .catch((err) => void this._handleAutoBatchError(err))
            .finally(() => this.batching.set(false));
    }

    dismissAutoBatchResult(): void {
        this.autoBatchResult.set(null);
    }

    // ---- Reset the day's batches -----------------------------------------

    openReset(template: TemplateRef<unknown>): void {
        if (this._resetDialogRef) {
            return;
        }
        this.resetForm.reset({
            targetDate: this.planningDate(),
            confirmation: '',
        });
        this.autoBatchError.set(null);
        this._resetDialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._resetDialogRef.afterClosed().subscribe(() => {
            this._resetDialogRef = null;
        });
    }

    closeReset(): void {
        this._resetDialogRef?.close();
    }

    runReset(): void {
        if (this.resetForm.invalid || this.resetting()) {
            this.resetForm.markAllAsTouched();
            return;
        }
        const { targetDate, confirmation } = this.resetForm.getRawValue();
        const dateIso =
            targetDate && DateTime.isDateTime(targetDate) && targetDate.isValid
                ? targetDate.toISODate()
                : null;
        this.resetting.set(true);
        this._admin
            .resetOrderGroups({ targetDate: dateIso, confirmation })
            .then(() => {
                this.closeReset();
                this.autoBatchResult.set(null);
                this._notifyKey('admin.orderGroups.reset.success');
                this._load();
            })
            .catch(
                (err) => void this._handleAutoBatchError(err, this.resetForm)
            )
            .finally(() => this.resetting.set(false));
    }

    /**
     * Batches the run produced. A dry run persists nothing, so `batchesCreated`
     * is 0 even when it has a full preview — the preview length is the honest
     * answer to "how many would this make".
     */
    resultBatchCount(result: AdminAutoBatchResult): number {
        return result.dryRun
            ? result.preview?.length ?? 0
            : result.batchesCreated ?? 0;
    }

    /** Orders the run absorbed, counted from the preview on a dry run. */
    resultOrderCount(result: AdminAutoBatchResult): number {
        if (!result.dryRun) {
            return result.ordersBatched ?? 0;
        }
        const ids = new Set<string>();
        for (const batch of result.preview ?? []) {
            for (const id of batch.coveredOrderIds ?? []) {
                ids.add(String(id));
            }
        }
        return ids.size;
    }

    /** Market name for a previewed batch, falling back to its id. */
    previewMarketLabel(batch: AdminAutoBatchBatch): string {
        const id = String(batch.marketId ?? '');
        return this.markets().find((m) => m.id === id)?.name || id || '—';
    }

    /** Localized reason the run grouped nothing (raw code as fallback). */
    skipReasonLabel(reason: string | null | undefined): string {
        const code = String(reason ?? '')
            .trim()
            .toLowerCase();
        if (!code) {
            return this._transloco.translate(
                'admin.orderGroups.skipReason.unknown'
            );
        }
        return KNOWN_SKIP_REASONS.has(code)
            ? this._transloco.translate('admin.orderGroups.skipReason.' + code)
            : String(reason);
    }

    /**
     * Turns an auto-batch / reset failure into an explained, localized banner,
     * flagging the offending date field on `form` when the server rejects it.
     */
    private async _handleAutoBatchError(
        err: unknown,
        form: {
            controls: { targetDate: AbstractControl };
        } = this.batchForm
    ): Promise<void> {
        const info = await readApiError(err);
        const message = await describeApiError(
            err,
            (key) => this._transloco.translate(key),
            'admin.orderGroups.actionError'
        );
        const alreadyRunning =
            info?.code === 'AUTO_BATCH_ALREADY_RUNNING' ||
            info?.code === 'BUSINESS_RULE_ERROR' ||
            info?.status === 409;
        if (info?.code === 'VALIDATION_ERROR' || info?.status === 400) {
            form.controls.targetDate.setErrors({ server: true });
        }
        this.autoBatchError.set({
            message,
            severity: alreadyRunning ? 'warning' : 'error',
        });
    }

    // ---- Row actions ------------------------------------------------------

    agentFor(row: AdminOrderGroupRow): AdminUserRow | undefined {
        const id = row.agentId;
        return id ? this.agents().find((agent) => agent.id === id) : undefined;
    }

    agentLabel(row: AdminOrderGroupRow): string {
        const agent = this.agentFor(row);
        if (!agent) {
            return row.agentEmail ?? '';
        }
        return agent.email || String(agent['name'] ?? '');
    }

    /** Market products in the batch that can still be handed to an agent. */
    assignableItemIds(row: AdminOrderGroupRow | null): string[] {
        const items = row?.['items'];
        if (!Array.isArray(items)) {
            return [];
        }
        const ids = items
            .filter((item) => !(item as AdminBatchItem)?.purchasedAt)
            .map((item) =>
                String((item as AdminBatchItem)?.marketProductId ?? '').trim()
            )
            .filter((id) => !!id);
        return [...new Set(ids)];
    }

    openAgentDialog(
        row: AdminOrderGroupRow,
        template: TemplateRef<unknown>
    ): void {
        this.agentDialogBatch.set(row);
        this.agentForm.reset({ agentUserId: row.agentId ?? '' });
        this.agentDialogSaving.set(false);
        this._agentDialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._agentDialogRef.afterClosed().subscribe(() => {
            this._agentDialogRef = null;
            this.agentDialogBatch.set(null);
        });
    }

    closeAgentDialog(): void {
        this._agentDialogRef?.close();
    }

    /**
     * Hands the batch to one agent, which the API now expresses as assigning
     * each of its line items to them: `POST /order-groups/{id}/agent` is gone,
     * and a batch is shopped per product. Items already purchased are left
     * alone — the command rejects the whole call with `ITEM_ALREADY_PURCHASED`
     * if one is included.
     */
    saveAgentAssignment(): void {
        const row = this.agentDialogBatch();
        const batchId = row ? this.batchIdOf(row) : '';
        const agentUserId = this.agentForm.getRawValue().agentUserId;
        if (!batchId || !agentUserId) {
            return;
        }
        const assignments = this.assignableItemIds(row).map(
            (marketProductId) => ({ marketProductId, agentUserId })
        );
        if (assignments.length === 0) {
            this._notifyKey('admin.orderGroups.assignAgent.noItems');
            return;
        }
        this.agentDialogSaving.set(true);
        const prepareSession =
            String(row?.status ?? '').toLowerCase() === 'built'
                ? this._admin.generateManifest(batchId)
                : Promise.resolve();
        prepareSession
            .then(() => this._admin.assignBatchItems(batchId, assignments))
            .then(() => {
                this._notifyKey('admin.orderGroups.assignAgent.success');
                this.closeAgentDialog();
                this._load();
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.agentDialogSaving.set(false));
    }

    // ---- Presentation helpers --------------------------------------------

    /** Localized batch / member status label (raw value as fallback). */
    statusLabel(status: string | null | undefined): string {
        if (!status) {
            return '—';
        }
        const key = statusLabelKey(status);
        if (!key) {
            return String(status);
        }
        const label = this._transloco.translate(key);
        return label && label !== key ? label : String(status);
    }

    sessionNeedsManifest(row: AdminOrderGroupRow): boolean {
        return String(row.status ?? '').toLowerCase() === 'built';
    }

    /** Start-of-day for a batch's date field, or null when missing/invalid. */
    private _batchDay(row: AdminOrderGroupRow): DateTime | null {
        const raw =
            row['batchDate'] ??
            row['BatchDate'] ??
            row.targetDate ??
            row.createdAt;
        if (raw === null || raw === undefined || raw === '') {
            return null;
        }
        const parsed = DateTime.fromISO(String(raw));
        return parsed.isValid ? parsed.startOf('day') : null;
    }

    sessionDateIso(row: AdminOrderGroupRow): string {
        return this._batchDay(row)?.toISODate() ?? '';
    }

    formatSessionDate(row: AdminOrderGroupRow): string {
        const date = this._batchDay(row);
        return date
            ? date.setLocale(this._transloco.getActiveLang()).toLocaleString({
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
              })
            : '';
    }

    private _deliveryDateIso(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        const parsed = DateTime.fromISO(String(value), { setZone: true });
        return parsed.isValid
            ? parsed.setZone(VIETNAM_ZONE).toISODate() ?? ''
            : '';
    }

    /** Locale date-time for a stored ISO value, or '' when missing/invalid. */
    formatDate(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    // ---- Data -------------------------------------------------------------

    private _load(): void {
        this._loadTask.trigger();
    }

    private readonly _loadTask = new CoalescedTask(async () => {
        this.loading.set(true);
        try {
            // Batches are cycle-scale — load the full set so mã-lô search /
            // filters work across every row, then paginate client-side.
            const pageSize = 100;
            const first = await this._admin.getOrderGroups(1, pageSize);
            const groups = [...first.groups];
            const total = first.totalCount;
            let page = 2;
            while (groups.length < total) {
                const next = await this._admin.getOrderGroups(page, pageSize);
                if (!next.groups.length) {
                    break;
                }
                groups.push(...next.groups);
                page += 1;
            }
            this.groups.set(groups);
            this.totalCount.set(groups.length);
            if (this.historyView) {
                await this._loadHistoryOrderDetails(groups);
            }
        } catch {
            this.groups.set([]);
            this.totalCount.set(0);
        } finally {
            this.loading.set(false);
        }
        // Progress is a separate endpoint and a separate failure: the table is
        // still useful when only the progress strip could not be read, so it
        // just hides rather than taking the page down with it.
        try {
            this.progress.set(await this._admin.getOrderGroupProgress());
        } catch {
            this.progress.set(null);
        }
    });

    private async _loadHistoryOrderDetails(
        groups: AdminOrderGroupRow[]
    ): Promise<void> {
        const ids = [
            ...new Set(
                groups
                    .filter(
                        (group) =>
                            group['isCompleted'] === true &&
                            String(group.status ?? '').toLowerCase() !==
                                'cancelled'
                    )
                    .flatMap((group) =>
                        this.membersOf(group).map((member) =>
                            String(member.orderId ?? '')
                        )
                    )
                    .filter(Boolean)
            ),
        ];
        if (!ids.length) {
            this.historyOrderDetails.set(new Map());
            return;
        }

        this.historySummaryLoading.set(true);
        const details = new Map<string, AdminOrderDetail>();
        try {
            for (let offset = 0; offset < ids.length; offset += 20) {
                const chunk = ids.slice(offset, offset + 20);
                const results = await Promise.all(
                    chunk.map(async (id) => {
                        try {
                            return [
                                id,
                                await this._admin.getOrder(id),
                            ] as const;
                        } catch {
                            return [id, null] as const;
                        }
                    })
                );
                for (const [id, detail] of results) {
                    if (detail) {
                        details.set(id, detail);
                    }
                }
            }
            this.historyOrderDetails.set(details);
        } finally {
            this.historySummaryLoading.set(false);
        }
    }

    private _loadPlanning(): void {
        this._loadPlanningTask.trigger();
    }

    private readonly _loadPlanningTask = new CoalescedTask(async () => {
        try {
            const pageSize = 100;
            const first = await this._admin.getOrders({
                status: 'confirmed',
                sort: 'createdAt:desc',
                page: 1,
                pageSize,
            });
            const orders = [...first.orders];
            let page = 2;
            while (orders.length < first.totalCount) {
                const next = await this._admin.getOrders({
                    status: 'confirmed',
                    sort: 'createdAt:desc',
                    page,
                    pageSize,
                });
                if (!next.orders.length) {
                    break;
                }
                orders.push(...next.orders);
                page += 1;
            }
            this.pendingOrders.set(orders);
            const restaurantIds = [
                ...new Set(
                    orders
                        .map((order) => String(order.restaurantId ?? ''))
                        .filter(Boolean)
                ),
            ];
            const profiles = await Promise.all(
                restaurantIds.map(async (id) => {
                    try {
                        const profile =
                            await this._admin.getRestaurantProfile(id);
                        return [id, String(profile?.name ?? id)] as const;
                    } catch {
                        return [id, id] as const;
                    }
                })
            );
            this.planningRestaurantNames.set(new Map(profiles));
        } catch {
            this.pendingOrders.set([]);
            this.planningRestaurantNames.set(new Map());
        }
        this.previewPlanningDay();
    });

    private _notifyKey(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    private async _notifyError(err: unknown): Promise<void> {
        const message = await describeApiError(
            err,
            (key) => this._transloco.translate(key),
            'admin.orderGroups.actionError'
        );
        this._snackBar.open(message, undefined, { duration: 5000 });
    }
}
