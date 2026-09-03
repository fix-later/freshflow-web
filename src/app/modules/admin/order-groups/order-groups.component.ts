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
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { readApiError } from 'app/core/api/envelope';
import { describeApiError } from 'app/core/api/error-codes';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { ApiLabelPipe } from 'app/core/i18n/api-label.pipe';
import { includesFolded } from 'app/core/util/text-search';
import { DateTime } from 'luxon';
import { AdminService } from '../admin.service';
import {
    AdminAutoBatchBatch,
    AdminAutoBatchResult,
    AdminBatchItem,
    AdminBatchMember,
    AdminMarketSession,
    AdminMarketSessionProductSummary,
    AdminMarketSessionResources,
    AdminMarketSessionTracking,
    AdminOrderDetail,
    AdminOrderGroupRow,
    AdminUserRow,
} from '../admin.types';
import { CatalogAdminService } from '../catalog/catalog-admin.service';
import { SessionFailedDelivery } from '../incidents/incidents.types';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import {
    LoadingManifest,
    OPTIMIZATION_CRITERIA,
    OptimizationCriterion,
    RouteDeliveryStatus,
    RouteEligibility,
    RoutePlanResult,
    RouteStop,
} from '../logistics/logistics-admin.types';
import { RouteMapComponent } from '../logistics/route-map.component';
import {
    routeStatusLabelKey,
    routeStatusPillClass,
} from '../logistics/route-status';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { ADMIN_DEFAULT_PAGE_SIZE } from '../shared/admin-pagination';
import { CoalescedTask } from '../shared/coalesced-task';
import { CrudRow } from '../shared/resource-crud.types';
import { TableSort } from '../shared/table-sort';
import {
    MarketSessionBatchingStatus,
    canRetryMarketSessionBatching,
    marketSessionBatchingStatus,
} from './market-session-batching-status';
import { statusLabelKey, statusPillClass } from './order-group-status';
import { SessionActivityComponent } from './session-activity.component';
import { SessionReportsComponent } from './session-reports.component';

/**
 * Reasons the run reports for doing nothing (`{"skipped":true,"reason":…}`).
 * Verified live: a run with nothing to group answers `no_eligible_orders`.
 * Anything unlisted falls back to the raw code rather than an empty banner.
 */
const KNOWN_SKIP_REASONS = new Set([
    'no_eligible_orders',
    'no_closed_sessions',
    'all_sessions_skipped',
    'already_completed',
    'already_batched',
    'batching_disabled',
    'outside_window',
]);

/**
 * How many orders the completed-session board reads at once.
 *
 * `/orders` allows 30 requests a minute per user and queues none of them
 * (`RateLimiting:Orders`), and this board reads one order per line of every
 * session it lists. Six at a time leaves room for whatever else the console is
 * doing in the same minute; the reads are memoised in
 * {@link AdminService.getSettledOrder}, so revisiting the board costs none.
 */
const HISTORY_ORDER_READ_CHUNK = 6;

/**
 * Where "Tuyến giao hàng" sits in the tracking dialog's tab strip.
 *
 * Named rather than written as a literal in three places: the tab order is a
 * reading order (what happened, then where it is going, then what went wrong),
 * and the last time it changed the deep link from the session card opened the
 * wrong panel because the number lived in the template.
 */
const ROUTING_TAB_INDEX = 3;

const VIETNAM_ZONE = 'Asia/Ho_Chi_Minh';
const UNASSIGNED_AGENT_ID = '00000000-0000-0000-0000-000000000000';

export function procurementItemAssignments(
    items: AdminBatchItem[],
    selectedAgents: Record<string, string>
): { marketProductId: string; agentUserId: string }[] {
    return items
        .filter((item) => !item.purchasedAt)
        .map((item) => {
            const marketProductId = String(item.marketProductId ?? '');
            return {
                marketProductId,
                agentUserId:
                    selectedAgents[marketProductId] || UNASSIGNED_AGENT_ID,
            };
        })
        .filter((assignment) => !!assignment.marketProductId);
}

/**
 * Finds the hub inbound created for a procurement batch. The Hub module uses
 * the batch id as `deliveryScheduleId`, so this remains stable when Hub Staff
 * scans the shipment and its status changes from PENDING to ARRIVED_AT_HUB.
 */
export function findMarketSessionInbound(
    rows: CrudRow[],
    batchId: string
): CrudRow | null {
    const expectedId = batchId.trim().toLowerCase();
    if (!expectedId) return null;
    return (
        rows.find(
            (row) =>
                String(row['deliveryScheduleId'] ?? '')
                    .trim()
                    .toLowerCase() === expectedId
        ) ?? null
    );
}

/** Cancelled proposals are retained by the backend for audit, not operation. */
export function activeMarketSessionRouteRows(rows: CrudRow[]): CrudRow[] {
    return rows.filter(
        (row) => String(row['status'] ?? '').toLowerCase() !== 'cancelled'
    );
}

function driverOptionLabel(driver: CrudRow): string {
    const name = String(driver['fullName'] ?? '').trim();
    const email = String(driver['email'] ?? '').trim();
    return name || email || `#${driver.id.slice(0, 8).toUpperCase()}`;
}

interface PlanningDay {
    iso: string;
    date: DateTime;
    draftSessions: number;
    openSessions: number;
    closedSessions: number;
}

interface TrackingProductCategoryGroup {
    key: string;
    label: string;
    products: AdminMarketSessionTracking['products'];
    quantities: { unit: string; total: number }[];
}

interface TrackingCatalogFields {
    marketProductId: string;
    unit?: string | null;
    unitName?: string | null;
    unitAbbreviation?: string | null;
    categoryId?: string | null;
    categoryName?: string | null;
    parentCategoryId?: string | null;
    parentCategoryName?: string | null;
}

interface MarketSessionRouteView {
    route: CrudRow;
    deliveries: RouteDeliveryStatus[];
    manifest: LoadingManifest | null;
}

/**
 * Who is taking a route out, resolved for display.
 *
 * `RouteDto` carries `driverUserId` and `vehicleId` and nothing else about
 * either, so every readable field here comes from the hub's own rosters. An id
 * the roster cannot name still travels — shortened — because "assigned to
 * someone this hub no longer lists" is precisely what an operator has to see,
 * and a blank line would report it as uncrewed.
 */
export interface RouteCrew {
    driverId: string;
    /** Name, else email, else the shortened id. */
    driverName: string;
    /** Only when the roster named the driver and carried one. */
    driverEmail: string;
    /** The roster has this driver, and has them deactivated. */
    driverInactive: boolean;
    /** The roster is loaded and does not have this driver at all. */
    driverOffRoster: boolean;
    vehicleId: string;
    /** Plate (and capacity), else the shortened id. */
    vehicleName: string;
    vehicleOffRoster: boolean;
}

interface MarketSessionRouteOrderView {
    orderId: string;
    restaurantName: string;
    orderStatus: string;
    delivery: RouteDeliveryStatus | null;
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

/** Exact destructive-action phrase enforced by ResetBatchingDayCommandValidator. */
export function resetConfirmationPhraseForDate(
    targetDate: DateTime | null
): string | null {
    if (!targetDate || !targetDate.isValid) {
        return null;
    }
    const iso = targetDate.toISODate();
    return iso ? `RESET ${iso}` : null;
}

function exactResetConfirmation(
    control: AbstractControl
): ValidationErrors | null {
    const targetDate = control.get('targetDate')?.value as DateTime | null;
    const confirmation = String(
        control.get('confirmation')?.value ?? ''
    ).trim();
    const expected = resetConfirmationPhraseForDate(targetDate);

    if (!confirmation || !expected) {
        return null;
    }
    return confirmation === expected ? null : { confirmationMismatch: true };
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
        RouteMapComponent,
        SessionActivityComponent,
        SessionReportsComponent,
        ApiLabelPipe,
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
        MatTabsModule,
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

            /*
             * The optimisation criterion sits beside the button that acts on
             * it, so it is that button's height. Material sizes an outlined
             * field for a floating label; with no label to float, the default
             * left the select standing taller than the button and half a label
             * out of line with it.
             */
            .ff-route__criteria .mat-mdc-text-field-wrapper {
                height: 2.5rem;
            }

            .ff-route__criteria .mat-mdc-form-field-infix {
                min-height: 2.5rem;
                padding-top: 0.5rem;
                padding-bottom: 0.5rem;
            }

            .ff-route__criteria .mat-mdc-form-field-subscript-wrapper {
                display: none;
            }

            .ff-route__criteria .mat-mdc-select-value {
                font-size: theme('fontSize.sm');
                font-weight: 600;
            }

            .planning-day-card {
                min-width: 10.5rem;
                transition:
                    border-color 160ms ease,
                    background-color 160ms ease,
                    box-shadow 160ms ease,
                    transform 160ms ease;
            }

            .planning-day-card:hover {
                transform: translateY(-1px);
            }

            /* The lift is decoration; the row still has to be usable without it. */
            @media (prefers-reduced-motion: reduce) {
                .planning-day-card {
                    transition: none;
                }

                .planning-day-card:hover {
                    transform: none;
                }
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
    private readonly _catalogAdmin = inject(CatalogAdminService);
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _dialog = inject(MatDialog);
    private readonly _router = inject(Router);
    private readonly _route = inject(ActivatedRoute);
    private readonly _permissions = inject(PermissionsService);

    readonly historyView = this._route.snapshot.data['view'] === 'history';

    readonly statusPillClass = statusPillClass;

    private _batchDialogRef: MatDialogRef<unknown> | null = null;
    private _resetDialogRef: MatDialogRef<unknown> | null = null;
    private _agentDialogRef: MatDialogRef<unknown> | null = null;
    private _marketSessionDialogRef: MatDialogRef<unknown> | null = null;
    private _marketSessionConfigurationDialogRef: MatDialogRef<unknown> | null =
        null;
    private _marketSessionCloseDialogRef: MatDialogRef<unknown> | null = null;
    private readonly _restaurantAddressCache = new Map<
        string,
        Promise<string | null>
    >();

    readonly groups = signal<AdminOrderGroupRow[]>([]);
    readonly agents = signal<AdminUserRow[]>([]);
    readonly markets = signal<{ id: string; name: string }[]>([]);
    readonly totalCount = signal(0);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly loading = signal(false);
    readonly historyOrderDetails = signal<Map<string, AdminOrderDetail>>(
        new Map()
    );
    readonly historySummaryLoading = signal(false);

    /**
     * At least one order behind the history figures could not be read.
     *
     * Kept apart from the loading flag because the two mean different things
     * to a reader: loading is "not yet", this is "not known" — and a total
     * missing an order must never be printed as if it were complete.
     */
    readonly historySummaryFailed = signal(false);
    readonly planningLoading = signal(false);
    readonly marketSessions = signal<AdminMarketSession[]>([]);
    readonly planningWindowDays = signal(8);
    readonly planningLoadFailed = signal(false);
    readonly planningActionError = signal<string | null>(null);
    readonly openingSessionId = signal<string | null>(null);
    readonly batchingSessionId = signal<string | null>(null);
    readonly routingSessionId = signal<string | null>(null);
    readonly trackedMarketSession = signal<AdminMarketSession | null>(null);
    readonly marketSessionTracking = signal<AdminMarketSessionTracking | null>(
        null
    );
    readonly marketSessionTrackingLoading = signal(false);
    readonly marketSessionTrackingError = signal(false);
    readonly marketSessionTrackingPageIndex = signal(0);
    readonly marketSessionTrackingPageSize = signal(20);
    readonly marketSessionTrackingTabIndex = signal(0);

    /**
     * Bumped by the dialog's one refresh button.
     *
     * The panels that fetch for themselves (hoạt động, báo cáo) cache what they
     * read by session, so they need to be told that a reload was asked for —
     * this counter is that word. Each tab used to carry its own refresh, which
     * put three buttons on a dialog that already had one in its header, and
     * none of them refreshed the panel beside it.
     */
    readonly marketSessionReloadToken = signal(0);
    readonly expandedTrackingOrderIds = signal<ReadonlySet<string>>(new Set());
    readonly marketSessionInbound = signal<CrudRow | null>(null);
    readonly marketSessionInboundLoading = signal(false);
    readonly marketSessionInboundError = signal(false);
    readonly marketSessionAssignmentBatch = signal<AdminOrderGroupRow | null>(
        null
    );
    readonly marketSessionAssignmentLoading = signal(false);
    readonly marketSessionAssignmentSaving = signal(false);
    readonly marketSessionAssignmentError = signal<string | null>(null);
    readonly marketSessionItemAssignments = signal<Record<string, string>>({});
    readonly savedMarketSessionItemAssignments = signal<Record<string, string>>(
        {}
    );
    readonly marketSessionAssignmentsDirty = computed(() => {
        const items = this.marketSessionAssignmentBatch()?.['items'];
        if (!Array.isArray(items)) return false;

        const current = this.marketSessionItemAssignments();
        const saved = this.savedMarketSessionItemAssignments();
        return (items as AdminBatchItem[])
            .filter(
                (item) =>
                    !!String(item.marketProductId ?? '') && !item.purchasedAt
            )
            .some((item) => {
                const id = String(item.marketProductId);
                return (current[id] ?? '') !== (saved[id] ?? '');
            });
    });
    readonly selectedMarketSessionAgentId = signal('');
    readonly marketSessionAgentOptions = computed(() => {
        const selectedIds = new Set(
            (this.trackedMarketSession()?.agentUserIds ?? []).map((id) =>
                id.toLowerCase()
            )
        );
        return this.agents().filter((agent) =>
            selectedIds.has(agent.id.toLowerCase())
        );
    });
    readonly selectedMarketSessionAgent = computed(() => {
        const selectedId = this.selectedMarketSessionAgentId();
        return (
            this.marketSessionAgentOptions().find(
                (agent) => agent.id === selectedId
            ) ?? null
        );
    });
    readonly routeCriteriaOptions = OPTIMIZATION_CRITERIA;
    readonly routeCriteria = new FormControl<OptimizationCriterion>(
        'distance',
        {
            nonNullable: true,
        }
    );
    readonly marketSessionRoutePlan = signal<RoutePlanResult | null>(null);
    readonly marketSessionRoutes = signal<MarketSessionRouteView[]>([]);
    readonly marketSessionRoutesLoading = signal(false);
    readonly marketSessionRoutesError = signal<string | null>(null);
    readonly marketSessionRoutesUpdatedAt = signal<Date | null>(null);
    readonly approvingRoutePlan = signal(false);
    readonly routeStatusPillClass = routeStatusPillClass;
    readonly configuredMarketSession = signal<AdminMarketSession | null>(null);
    readonly marketSessionConfigurationSaving = signal(false);
    readonly marketSessionResources =
        signal<AdminMarketSessionResources | null>(null);
    readonly marketSessionResourcesLoading = signal(false);
    readonly marketSessionConfigurationError = signal<string | null>(null);
    readonly marketSessionConfigurationForm = this._formBuilder.group({
        closesAt: ['', Validators.required],
        plannedCapacityKg: new FormControl<number | null>(null, [
            Validators.min(0.01),
            Validators.max(1_000_000),
        ]),
        vehicleIds: new FormControl<string[]>([], {
            nonNullable: true,
            validators: Validators.required,
        }),
        agentUserIds: new FormControl<string[]>([], {
            nonNullable: true,
            validators: Validators.required,
        }),
    });
    readonly closingMarketSession = signal<AdminMarketSession | null>(null);
    readonly closingMarketSessionTracking =
        signal<AdminMarketSessionTracking | null>(null);
    readonly marketSessionCloseSummaryLoading = signal(false);
    readonly marketSessionCloseSaving = signal(false);
    readonly marketSessionCloseError = signal<string | null>(null);
    readonly marketSessionCloseForm = this._formBuilder.group({
        reason: ['', Validators.maxLength(500)],
    });
    readonly canOpenMarketSessions = computed(() =>
        this._permissions.hasRole('admin')
    );
    readonly marketSessionProductCategoryGroups = computed<
        TrackingProductCategoryGroup[]
    >(() => {
        const groups = new Map<string, TrackingProductCategoryGroup>();
        for (const product of this.marketSessionTracking()?.products ?? []) {
            const key =
                product.parentCategoryId ||
                product.categoryId ||
                product.parentCategoryName ||
                product.categoryName ||
                '__uncategorized__';
            const label =
                product.parentCategoryName || product.categoryName || '';
            let group = groups.get(key);
            if (!group) {
                group = { key, label, products: [], quantities: [] };
                groups.set(key, group);
            }
            group.products.push(product);
        }
        return [...groups.values()]
            .map((group) => {
                const totals = new Map<string, number>();
                for (const product of group.products) {
                    const unit = this.trackingProductUnit(product);
                    totals.set(
                        unit,
                        (totals.get(unit) ?? 0) + product.totalQuantity
                    );
                }
                return {
                    ...group,
                    products: [...group.products].sort((a, b) =>
                        a.productName.localeCompare(b.productName, 'vi')
                    ),
                    quantities: [...totals].map(([unit, total]) => ({
                        unit,
                        total,
                    })),
                };
            })
            .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    });
    readonly marketSessionQuantityTotals = computed(() =>
        this._quantityTotals(this.marketSessionTracking()?.products)
    );

    /**
     * The same per-unit totals for the session the close dialog is asking
     * about.
     *
     * A single figure across every product is not a quantity anyone can act on:
     * kilos of rau, thùng of nước and bó of hành summed together mean nothing,
     * and "0" reads as "nothing to lose" whatever the session actually holds.
     */
    readonly closingSessionQuantityTotals = computed(() =>
        this._quantityTotals(this.closingMarketSessionTracking()?.products)
    );

    private readonly _localToday = DateTime.now()
        .setZone(VIETNAM_ZONE)
        .startOf('day');
    readonly tomorrowDate = this._localToday.plus({ days: 1 });
    readonly planningDate = signal<DateTime>(this._localToday);

    /** Delivery dates in the ordering window this platform is configured for. */
    readonly planningDays = computed<PlanningDay[]>(() => {
        const dates = new Set<string>();
        for (let offset = 0; offset < this.planningWindowDays(); offset += 1) {
            const iso = this._localToday.plus({ days: offset }).toISODate();
            if (iso) {
                dates.add(iso);
            }
        }

        return [...dates]
            .sort()
            .slice(0, this.planningWindowDays())
            .map((iso) => {
                const sessions = this.marketSessions().filter(
                    (session) => session.serviceDate === iso
                );
                return {
                    iso,
                    date: DateTime.fromISO(iso, { zone: VIETNAM_ZONE }),
                    draftSessions: sessions.filter(
                        (session) => session.status === 'draft'
                    ).length,
                    openSessions: sessions.filter(
                        (session) => session.status === 'open'
                    ).length,
                    closedSessions: sessions.filter(
                        (session) => session.status === 'closed'
                    ).length,
                };
            });
    });

    readonly selectedPlanningIso = computed(
        () => this.planningDate().toISODate() ?? ''
    );

    readonly selectedMarketSessions = computed(() =>
        this.marketSessions().filter(
            (session) => session.serviceDate === this.selectedPlanningIso()
        )
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

    /** The board's invoice total, or `null` when an order behind it is missing. */
    readonly historyInvoiceTotal = computed<number | null>(() => {
        const ids = new Set<string>();
        for (const group of this.filteredGroups()) {
            for (const member of this.membersOf(group)) {
                const id = String(member.orderId ?? '');
                if (id) {
                    ids.add(id);
                }
            }
        }
        const details = this.historyOrderDetails();
        let total = 0;
        for (const id of ids) {
            const detail = details.get(id);
            if (!detail) {
                return null;
            }
            total += Number(detail.totalAmount ?? 0);
        }
        return total;
    });

    readonly batchForm = this._formBuilder.group({
        targetDate: this._formBuilder.control<DateTime | null>(
            this.tomorrowDate,
            {
                validators: [Validators.required, validTargetDate],
            }
        ),
        dryRun: this._formBuilder.nonNullable.control(true),
    });

    readonly resetForm = this._formBuilder.group(
        {
            targetDate: this._formBuilder.control<DateTime | null>(
                this.tomorrowDate,
                {
                    validators: [Validators.required, validTargetDate],
                }
            ),
            confirmation: this._formBuilder.nonNullable.control('', {
                validators: [Validators.required],
            }),
        },
        { validators: [exactResetConfirmation] }
    );

    ngOnInit(): void {
        this._load();
        void Promise.all([
            this._admin
                .getAgentOptions()
                .then((agents) => {
                    this.agents.set(agents);
                    this.ensureMarketSessionAgentSelection();
                })
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
        if (this.planningLoading()) {
            return;
        }
        this.planningDate.set(day.date);
        this.planningActionError.set(null);
    }

    refreshMarketSessions(): void {
        this._loadPlanning();
    }

    openMarketSessionTracking(
        session: AdminMarketSession,
        template: TemplateRef<unknown>,
        initialTab = 0
    ): void {
        if (this._marketSessionDialogRef) return;
        this.marketSessionTrackingTabIndex.set(initialTab);
        this.trackedMarketSession.set(session);
        this.marketSessionTracking.set(null);
        this.marketSessionTrackingError.set(false);
        this.marketSessionTrackingPageIndex.set(0);
        this.expandedTrackingOrderIds.set(new Set());
        this.marketSessionInbound.set(null);
        this.marketSessionInboundError.set(false);
        this.marketSessionAssignmentBatch.set(null);
        this.marketSessionItemAssignments.set({});
        this.savedMarketSessionItemAssignments.set({});
        this.selectedMarketSessionAgentId.set('');
        this.marketSessionAssignmentError.set(null);
        this.marketSessionRoutePlan.set(null);
        this.marketSessionRoutes.set([]);
        this.marketSessionRoutesError.set(null);
        this._marketSessionDialogRef = this._dialog.open(template, {
            autoFocus: false,
            maxWidth: '96vw',
            width: '1080px',
        });
        this._marketSessionDialogRef.afterClosed().subscribe(() => {
            this._marketSessionDialogRef = null;
            this.marketSessionTrackingLoading.set(false);
        });
        this.refreshMarketSessionTracking();
    }

    closeMarketSessionTracking(): void {
        this._marketSessionDialogRef?.close();
    }

    refreshMarketSessionTracking(): void {
        const session = this.trackedMarketSession();
        if (!session || this.marketSessionTrackingLoading()) return;
        this.marketSessionReloadToken.update((token) => token + 1);
        this.marketSessionTrackingLoading.set(true);
        this.marketSessionTrackingError.set(false);
        this._admin
            .getMarketSessionTracking(
                session.id,
                this.marketSessionTrackingPageIndex() + 1,
                this.marketSessionTrackingPageSize()
            )
            .then((tracking) => this._enrichMarketSessionTracking(tracking))
            .then((tracking) => {
                this.trackedMarketSession.set(tracking.session);
                this.marketSessionTracking.set(tracking);
                this.marketSessions.update((sessions) =>
                    sessions.map((item) =>
                        item.id === tracking.session.id
                            ? tracking.session
                            : item
                    )
                );
                void this._loadMarketSessionAssignmentBatch(
                    tracking.batch?.id ?? null
                );
                this.loadMarketSessionInbound();
                void this.loadMarketSessionRoutes();
            })
            .catch(() => this.marketSessionTrackingError.set(true))
            .finally(() => this.marketSessionTrackingLoading.set(false));
    }

    selectMarketSessionTrackingTab(index: number): void {
        this.marketSessionTrackingTabIndex.set(index);
        if (index === ROUTING_TAB_INDEX) this.loadMarketSessionRoutes();
    }

    marketSessionBatchItem(
        marketProductId: string | null | undefined
    ): AdminBatchItem | null {
        const items = this.marketSessionAssignmentBatch()?.['items'];
        if (!Array.isArray(items)) return null;
        const id = String(marketProductId ?? '');
        return (
            (items.find(
                (item) =>
                    String((item as AdminBatchItem).marketProductId ?? '') ===
                    id
            ) as AdminBatchItem | undefined) ?? null
        );
    }

    marketSessionItemAssignment(
        marketProductId: string | null | undefined
    ): string {
        return (
            this.marketSessionItemAssignments()[
                String(marketProductId ?? '')
            ] ?? ''
        );
    }

    selectMarketSessionAgent(agentUserId: string): void {
        if (
            this.marketSessionAgentOptions().some(
                (agent) => agent.id === agentUserId
            )
        ) {
            this.selectedMarketSessionAgentId.set(agentUserId);
            this.marketSessionAssignmentError.set(null);
        }
    }

    setMarketSessionItemForSelectedAgent(
        marketProductId: string | null | undefined,
        checked: boolean
    ): void {
        const id = String(marketProductId ?? '');
        const agentUserId = this.selectedMarketSessionAgentId();
        if (!id || !agentUserId) return;
        this.marketSessionItemAssignments.update((assignments) => {
            if (!checked && assignments[id] !== agentUserId) return assignments;
            return {
                ...assignments,
                [id]: checked ? agentUserId : '',
            };
        });
        this.marketSessionAssignmentError.set(null);
    }

    setAllMarketSessionItemsForSelectedAgent(checked: boolean): void {
        const agentUserId = this.selectedMarketSessionAgentId();
        if (!agentUserId) return;
        const items = this.marketSessionAssignableItems();
        this.marketSessionItemAssignments.update((assignments) => {
            const next = { ...assignments };
            for (const item of items) {
                const id = String(item.marketProductId ?? '');
                if (!id) continue;
                if (checked) {
                    next[id] = agentUserId;
                } else if (next[id] === agentUserId) {
                    next[id] = '';
                }
            }
            return next;
        });
        this.marketSessionAssignmentError.set(null);
    }

    marketSessionAgentAssignmentCount(agentUserId: string): number {
        return Object.values(this.marketSessionItemAssignments()).filter(
            (assignedAgentId) => assignedAgentId === agentUserId
        ).length;
    }

    marketSessionSelectedAgentAssignmentCount(): number {
        return this.marketSessionAgentAssignmentCount(
            this.selectedMarketSessionAgentId()
        );
    }

    marketSessionAllItemsAssignedToSelectedAgent(): boolean {
        const agentUserId = this.selectedMarketSessionAgentId();
        const items = this.marketSessionAssignableItems();
        return (
            !!agentUserId &&
            items.length > 0 &&
            items.every(
                (item) =>
                    this.marketSessionItemAssignment(item.marketProductId) ===
                    agentUserId
            )
        );
    }

    marketSessionSomeItemsAssignedToSelectedAgent(): boolean {
        const agentUserId = this.selectedMarketSessionAgentId();
        const items = this.marketSessionAssignableItems();
        const selectedCount = items.filter(
            (item) =>
                this.marketSessionItemAssignment(item.marketProductId) ===
                agentUserId
        ).length;
        return selectedCount > 0 && selectedCount < items.length;
    }

    marketSessionAssignedAgentLabel(
        marketProductId: string | null | undefined
    ): string {
        const agentUserId = this.marketSessionItemAssignment(marketProductId);
        if (!agentUserId) return '';
        const agent = this.marketSessionAgentOptions().find(
            (option) => option.id === agentUserId
        );
        return agent ? this.marketSessionAgentLabel(agent) : agentUserId;
    }

    marketSessionAgentLabel(agent: AdminUserRow): string {
        return agent.fullName?.trim() || agent.email || agent.id;
    }

    private marketSessionAssignableItems(): AdminBatchItem[] {
        const items = this.marketSessionAssignmentBatch()?.['items'];
        if (!Array.isArray(items)) return [];
        return (items as AdminBatchItem[]).filter(
            (item) => !!String(item.marketProductId ?? '') && !item.purchasedAt
        );
    }

    canEditMarketSessionAssignments(
        batch: AdminOrderGroupRow | null = this.marketSessionAssignmentBatch()
    ): boolean {
        const status = String(batch?.status ?? '').toLowerCase();
        return ['built', 'manifested', 'purchasing'].includes(status);
    }

    marketSessionHasAssignableItems(
        batch: AdminOrderGroupRow | null = this.marketSessionAssignmentBatch()
    ): boolean {
        const items = batch?.['items'];
        return (
            Array.isArray(items) &&
            items.some(
                (item) =>
                    !!String((item as AdminBatchItem).marketProductId ?? '') &&
                    !(item as AdminBatchItem).purchasedAt
            )
        );
    }

    async saveMarketSessionItemAssignments(): Promise<void> {
        const batch = this.marketSessionAssignmentBatch();
        const batchId = batch ? this.batchIdOf(batch) : '';
        if (
            !batchId ||
            !this.canEditMarketSessionAssignments(batch) ||
            !this.marketSessionHasAssignableItems(batch) ||
            !this.marketSessionAssignmentsDirty() ||
            this.marketSessionAssignmentSaving()
        ) {
            return;
        }

        const items = batch?.['items'];
        if (!Array.isArray(items)) return;
        const assignments = procurementItemAssignments(
            items as AdminBatchItem[],
            this.marketSessionItemAssignments()
        );

        this.marketSessionAssignmentSaving.set(true);
        this.marketSessionAssignmentError.set(null);
        try {
            if (String(batch.status ?? '').toLowerCase() === 'built') {
                await this._admin.generateManifest(batchId);
            }
            await this._admin.assignBatchItems(batchId, assignments);
            this._notifyKey(
                'admin.orderGroups.marketSessions.procurement.saveSuccess'
            );
            await this._loadMarketSessionAssignmentBatch(batchId);
            this._load();
            this.refreshMarketSessionTracking();
        } catch (err) {
            const message = await describeApiError(
                err,
                (key) => this._transloco.translate(key),
                'admin.orderGroups.marketSessions.procurement.saveError'
            );
            this.marketSessionAssignmentError.set(message);
            this._snackBar.open(message, undefined, { duration: 5000 });
        } finally {
            this.marketSessionAssignmentSaving.set(false);
        }
    }

    private async _loadMarketSessionAssignmentBatch(
        batchId: string | null
    ): Promise<void> {
        if (!batchId) {
            this.marketSessionAssignmentBatch.set(null);
            this.marketSessionItemAssignments.set({});
            this.savedMarketSessionItemAssignments.set({});
            this.selectedMarketSessionAgentId.set('');
            this.marketSessionAssignmentError.set(null);
            return;
        }

        this.marketSessionAssignmentLoading.set(true);
        this.marketSessionAssignmentError.set(null);
        try {
            const batch = await this._admin.getOrderGroup(batchId);
            if (this.marketSessionTracking()?.batch?.id !== batchId) return;
            if (!batch) {
                throw new Error('PROCUREMENT_BATCH_NOT_FOUND');
            }
            this.marketSessionAssignmentBatch.set(batch);
            const assignments: Record<string, string> = {};
            const items = batch['items'];
            if (Array.isArray(items)) {
                for (const rawItem of items) {
                    const item = rawItem as AdminBatchItem;
                    const marketProductId = String(item.marketProductId ?? '');
                    if (marketProductId) {
                        assignments[marketProductId] = String(
                            item.assignedAgentUserId ?? ''
                        );
                    }
                }
            }
            this.marketSessionItemAssignments.set(assignments);
            this.savedMarketSessionItemAssignments.set({ ...assignments });
            this.ensureMarketSessionAgentSelection();
        } catch (err) {
            if (this.marketSessionTracking()?.batch?.id !== batchId) return;
            const message = await describeApiError(
                err,
                (key) => this._transloco.translate(key),
                'admin.orderGroups.marketSessions.procurement.loadError'
            );
            this.marketSessionAssignmentError.set(message);
            this.marketSessionAssignmentBatch.set(null);
            this.marketSessionItemAssignments.set({});
            this.savedMarketSessionItemAssignments.set({});
            this.selectedMarketSessionAgentId.set('');
        } finally {
            if (this.marketSessionTracking()?.batch?.id === batchId) {
                this.marketSessionAssignmentLoading.set(false);
            }
        }
    }

    private ensureMarketSessionAgentSelection(): void {
        const agentOptions = this.marketSessionAgentOptions();
        const currentAgentId = this.selectedMarketSessionAgentId();
        if (agentOptions.some((agent) => agent.id === currentAgentId)) return;

        const assignedAgentId = Object.values(
            this.marketSessionItemAssignments()
        ).find(
            (agentId) =>
                !!agentId && agentOptions.some((agent) => agent.id === agentId)
        );
        this.selectedMarketSessionAgentId.set(
            assignedAgentId ?? agentOptions[0]?.id ?? ''
        );
    }

    loadMarketSessionRoutes(): void {
        const session = this.trackedMarketSession();
        if (!session || !session.hubId || this.marketSessionRoutesLoading()) {
            return;
        }
        this.marketSessionRoutesLoading.set(true);
        this.marketSessionRoutesError.set(null);
        // The rosters, alongside the routes rather than only when the dispatch
        // form is opened: an assigned route names its driver and truck by id,
        // and these lists are the only thing that can turn those into a person
        // and a plate. Independent of the read below, and failure-tolerant per
        // call, so a roster this hub cannot serve never costs us the routes.
        void this._loadDispatchOptions();
        void this._loadMarketSessionRouteViews(session)
            .then((routes) => {
                this.marketSessionRoutes.set(routes);
                this.marketSessionRoutesUpdatedAt.set(new Date());
            })
            .catch(async (err) => {
                this.marketSessionRoutesError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.orderGroups.marketSessions.routing.loadError'
                    )
                );
            })
            .finally(() => this.marketSessionRoutesLoading.set(false));
    }

    loadMarketSessionInbound(): void {
        const tracking = this.marketSessionTracking();
        const hubId = tracking?.session.hubId;
        const batchId = tracking?.batch?.id;
        if (!hubId || !batchId) {
            this.marketSessionInbound.set(null);
            this.marketSessionInboundError.set(false);
            return;
        }
        if (this.marketSessionInboundLoading()) return;

        this.marketSessionInboundLoading.set(true);
        this.marketSessionInboundError.set(false);
        void this._logistics
            .getPendingInbound(hubId)
            .then((rows) => {
                if (this.marketSessionTracking()?.batch?.id !== batchId) return;
                const inbound = findMarketSessionInbound(rows, batchId);
                this.marketSessionInbound.set(inbound);
            })
            .catch(() => this.marketSessionInboundError.set(true))
            .finally(() => this.marketSessionInboundLoading.set(false));
    }

    onMarketSessionTrackingPage(event: PageEvent): void {
        this.marketSessionTrackingPageIndex.set(event.pageIndex);
        this.marketSessionTrackingPageSize.set(event.pageSize);
        this.refreshMarketSessionTracking();
    }

    toggleTrackingOrder(orderId: string): void {
        this.expandedTrackingOrderIds.update((current) => {
            const next = new Set(current);
            if (next.has(orderId)) {
                next.delete(orderId);
            } else {
                next.add(orderId);
            }
            return next;
        });
    }

    isTrackingOrderExpanded(orderId: string): boolean {
        return this.expandedTrackingOrderIds().has(orderId);
    }

    openMarketSessionConfiguration(
        session: AdminMarketSession,
        template: TemplateRef<unknown>
    ): void {
        if (
            !this.canOpenMarketSessions() ||
            this._marketSessionConfigurationDialogRef
        ) {
            return;
        }
        this.configuredMarketSession.set(session);
        this.marketSessionConfigurationError.set(null);
        this.marketSessionResources.set(null);
        this.marketSessionResourcesLoading.set(true);
        const closesAt = DateTime.fromISO(session.closesAt).setZone(
            VIETNAM_ZONE
        );
        this.marketSessionConfigurationForm.reset({
            closesAt: closesAt.isValid
                ? closesAt.toFormat("yyyy-MM-dd'T'HH:mm")
                : '',
            plannedCapacityKg: session.plannedCapacityKg ?? null,
            vehicleIds: session.vehicleIds ?? [],
            agentUserIds: session.agentUserIds ?? [],
        });
        this._marketSessionConfigurationDialogRef = this._dialog.open(
            template,
            {
                autoFocus: false,
                maxWidth: '96vw',
                width: '640px',
            }
        );
        this._marketSessionConfigurationDialogRef
            .afterClosed()
            .subscribe(() => {
                this._marketSessionConfigurationDialogRef = null;
                this.marketSessionConfigurationSaving.set(false);
                this.marketSessionResourcesLoading.set(false);
                this.configuredMarketSession.set(null);
                this.marketSessionResources.set(null);
            });

        void this._admin
            .getMarketSessionResources(session.id)
            .then((resources) => {
                if (this.configuredMarketSession()?.id !== session.id) return;
                this.marketSessionResources.set(resources);
                this.marketSessionConfigurationForm.patchValue({
                    plannedCapacityKg: resources.plannedCapacityKg ?? null,
                    vehicleIds: resources.vehicles
                        .filter((vehicle) => vehicle.selected)
                        .map((vehicle) => vehicle.vehicleId),
                    agentUserIds: resources.agents
                        .filter((agent) => agent.selected)
                        .map((agent) => agent.userId),
                });
            })
            .catch(async (err) => {
                if (this.configuredMarketSession()?.id !== session.id) return;
                const message = await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'admin.orderGroups.marketSessions.configuration.resourcesLoadError'
                );
                this.marketSessionConfigurationError.set(message);
            })
            .finally(() => {
                if (this.configuredMarketSession()?.id === session.id) {
                    this.marketSessionResourcesLoading.set(false);
                }
            });
    }

    closeMarketSessionConfiguration(): void {
        this._marketSessionConfigurationDialogRef?.close();
    }

    selectedVehicleCapacityKg(): number {
        const resources = this.marketSessionResources();
        if (!resources) return 0;
        const selectedIds = new Set(
            this.marketSessionConfigurationForm.controls.vehicleIds.value
        );
        return resources.vehicles.reduce(
            (total, vehicle) =>
                total +
                (selectedIds.has(vehicle.vehicleId)
                    ? Number(vehicle.capacityKg ?? 0)
                    : 0),
            0
        );
    }

    saveMarketSessionConfiguration(): void {
        const session = this.configuredMarketSession();
        if (
            !session ||
            session.status === 'closed' ||
            this.marketSessionConfigurationSaving() ||
            this.marketSessionResourcesLoading()
        ) {
            return;
        }
        if (this.marketSessionConfigurationForm.invalid) {
            this.marketSessionConfigurationForm.markAllAsTouched();
            return;
        }
        const localValue =
            this.marketSessionConfigurationForm.controls.closesAt.value;
        const closesAt = DateTime.fromISO(localValue ?? '', {
            zone: VIETNAM_ZONE,
        });
        if (!closesAt.isValid || closesAt <= DateTime.now()) {
            this.marketSessionConfigurationForm.controls.closesAt.setErrors({
                future: true,
            });
            return;
        }
        const closesAtUtc = closesAt.toUTC().toISO();
        if (!closesAtUtc) return;
        const formValue = this.marketSessionConfigurationForm.getRawValue();

        this.marketSessionConfigurationSaving.set(true);
        this.marketSessionConfigurationError.set(null);
        this._admin
            .updateMarketSessionCloseTime(session.id, closesAtUtc)
            .then(() =>
                this._admin.configureMarketSessionResources(session.id, {
                    plannedCapacityKg: formValue.plannedCapacityKg,
                    vehicleIds: formValue.vehicleIds,
                    agentUserIds: formValue.agentUserIds,
                })
            )
            .then((resources) => {
                this.marketSessionResources.set(resources);
                return this._admin.getMarketSession(session.id);
            })
            .then((updated) => {
                this.configuredMarketSession.set(updated);
                this.marketSessions.update((sessions) =>
                    sessions.map((item) =>
                        item.id === updated.id ? updated : item
                    )
                );
                if (this.trackedMarketSession()?.id === updated.id) {
                    this.trackedMarketSession.set(updated);
                    this.marketSessionTracking.update((tracking) =>
                        tracking ? { ...tracking, session: updated } : tracking
                    );
                }
                this._notifyKey(
                    'admin.orderGroups.marketSessions.configuration.saveSuccess'
                );
                this.closeMarketSessionConfiguration();
            })
            .catch(async (err) => {
                const message = await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'admin.orderGroups.marketSessions.configuration.saveError'
                );
                this.marketSessionConfigurationError.set(message);
            })
            .finally(() => this.marketSessionConfigurationSaving.set(false));
    }

    manageMarketSessionVehicles(): void {
        this.manageMarketSessionResource('vehicles');
    }

    manageMarketSessionResource(tab: 'staff' | 'hubs' | 'vehicles'): void {
        const session = this.configuredMarketSession();
        if (!session) return;
        this.closeMarketSessionConfiguration();
        void this._router.navigate(['/admin/markets', session.marketId], {
            queryParams: { tab },
        });
    }

    manageMarketSessionOperationalSettings(): void {
        this.closeMarketSessionConfiguration();
        void this._router.navigate(['/admin/order-group-settings']);
    }

    openMarketSessionClose(
        session: AdminMarketSession,
        template: TemplateRef<unknown>
    ): void {
        if (
            !this.canCloseMarketSession(session) ||
            this._marketSessionCloseDialogRef
        ) {
            return;
        }

        this.closingMarketSession.set(session);
        this.marketSessionCloseError.set(null);
        this.marketSessionCloseForm.reset({ reason: '' });
        const currentTracking =
            this.marketSessionTracking()?.session.id === session.id
                ? this.marketSessionTracking()
                : null;
        this.closingMarketSessionTracking.set(currentTracking);

        this._marketSessionCloseDialogRef = this._dialog.open(template, {
            autoFocus: false,
            maxWidth: '96vw',
            width: '640px',
        });
        this._marketSessionCloseDialogRef.afterClosed().subscribe(() => {
            this._marketSessionCloseDialogRef = null;
            this.marketSessionCloseSaving.set(false);
            this.marketSessionCloseSummaryLoading.set(false);
        });

        if (!currentTracking) {
            this.marketSessionCloseSummaryLoading.set(true);
            void this._admin
                .getMarketSessionTracking(session.id, 1, 1)
                .then((tracking) => {
                    if (this.closingMarketSession()?.id === session.id) {
                        this.closingMarketSessionTracking.set(tracking);
                    }
                })
                .catch(() => undefined)
                .finally(() =>
                    this.marketSessionCloseSummaryLoading.set(false)
                );
        }
    }

    closeMarketSessionCloseDialog(): void {
        this._marketSessionCloseDialogRef?.close();
    }

    confirmCloseMarketSession(): void {
        const session = this.closingMarketSession();
        if (
            !session ||
            !this.canCloseMarketSession(session) ||
            this.marketSessionCloseSaving()
        ) {
            return;
        }
        if (this.marketSessionCloseForm.invalid) {
            this.marketSessionCloseForm.markAllAsTouched();
            return;
        }

        const reason =
            this.marketSessionCloseForm.controls.reason.value?.trim() || null;
        this.marketSessionCloseSaving.set(true);
        this.marketSessionCloseError.set(null);
        this._admin
            .closeMarketSession(session.id, reason)
            .then((closed) => {
                this.marketSessions.update((sessions) =>
                    sessions.map((item) =>
                        item.id === closed.id ? closed : item
                    )
                );
                if (this.trackedMarketSession()?.id === closed.id) {
                    this.trackedMarketSession.set(closed);
                    this.marketSessionTracking.update((tracking) =>
                        tracking ? { ...tracking, session: closed } : tracking
                    );
                }
                if (this.configuredMarketSession()?.id === closed.id) {
                    this.configuredMarketSession.set(closed);
                }
                this._notifyKey(
                    'admin.orderGroups.marketSessions.close.success'
                );
                this.closeMarketSessionCloseDialog();
                // Close triggers BE's first batching attempt synchronously.
                // Refresh both sides of the transition: the session gains
                // `batchingCompletedAt`, while a successful attempt creates a
                // procurement batch used by the actions below this workspace.
                this._load();
                this._loadPlanning();
                if (this.trackedMarketSession()?.id === closed.id) {
                    this.refreshMarketSessionTracking();
                }
            })
            .catch(async (err) => {
                const message = await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'admin.orderGroups.marketSessions.close.error'
                );
                this.marketSessionCloseError.set(message);
            })
            .finally(() => this.marketSessionCloseSaving.set(false));
    }

    canCloseMarketSession(session: AdminMarketSession): boolean {
        return (
            this.canOpenMarketSessions() &&
            session.status !== 'closed' &&
            !this.marketSessionCloseSaving()
        );
    }

    openMarketSession(session: AdminMarketSession): void {
        if (
            !this.canOpenMarketSessions() ||
            session.status !== 'draft' ||
            session.readiness !== 'ready' ||
            this.isSessionCutoffPassed(session) ||
            this.openingSessionId()
        ) {
            return;
        }

        this.openingSessionId.set(session.id);
        this.planningActionError.set(null);
        this._admin
            .openMarketSession(session.id)
            .then((opened) => {
                this.marketSessions.update((sessions) =>
                    sessions.map((item) =>
                        item.id === opened.id ? opened : item
                    )
                );
                if (this.trackedMarketSession()?.id === opened.id) {
                    this.trackedMarketSession.set(opened);
                    this.marketSessionTracking.update((tracking) =>
                        tracking ? { ...tracking, session: opened } : tracking
                    );
                }
                this._notifyKey('admin.orderGroups.marketSessions.openSuccess');
                this._loadPlanning();
            })
            .catch(async (err) => {
                const message = await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'admin.orderGroups.marketSessions.openError'
                );
                this.planningActionError.set(message);
                this._snackBar.open(message, undefined, { duration: 5000 });
                // Readiness and state may have changed since the list response.
                this._loadPlanning();
            })
            .finally(() => this.openingSessionId.set(null));
    }

    canOpenMarketSession(session: AdminMarketSession): boolean {
        return (
            this.canOpenMarketSessions() &&
            session.status === 'draft' &&
            session.readiness === 'ready' &&
            !this.isSessionCutoffPassed(session) &&
            !this.openingSessionId()
        );
    }

    isSessionCutoffPassed(session: AdminMarketSession): boolean {
        const closesAt = DateTime.fromISO(session.closesAt);
        return !closesAt.isValid || closesAt <= DateTime.now();
    }

    marketSessionName(session: AdminMarketSession): string {
        return (
            session.marketName ||
            this.markets().find((market) => market.id === session.marketId)
                ?.name ||
            session.marketId
        );
    }

    marketSessionStatusLabel(session: AdminMarketSession): string {
        return this._transloco.translate(
            `admin.orderGroups.marketSessions.status.${session.status}`
        );
    }

    marketSessionStatusClass(session: AdminMarketSession): string {
        switch (session.status) {
            case 'open':
                return 'bg-green-100 text-green-800 dark:bg-green-500 dark:text-green-50';
            case 'closed':
                return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-50';
            default:
                return 'bg-amber-100 text-amber-800 dark:bg-amber-500 dark:text-amber-50';
        }
    }

    /**
     * How far the session has come, as a percentage for the card's footer bar:
     * nháp → đang nhận đơn → đã gom → đã đóng.
     *
     * Read off the two fields that actually record it (`status`,
     * `batchingCompletedAt`) rather than kept as a step counter of its own, so
     * the bar cannot disagree with the pills above it.
     */
    marketSessionProgress(session: AdminMarketSession): number {
        if (session.status === 'closed') {
            return 100;
        }
        if (this.marketSessionBatchingStatus(session) === 'completed') {
            return 75;
        }
        return session.status === 'open' ? 50 : 15;
    }

    marketSessionBatchingStatus(
        session: AdminMarketSession
    ): MarketSessionBatchingStatus {
        return marketSessionBatchingStatus(session);
    }

    marketSessionBatchingLabel(session: AdminMarketSession): string {
        return this._transloco.translate(
            `admin.orderGroups.marketSessions.batching.status.${this.marketSessionBatchingStatus(session)}`
        );
    }

    marketSessionBatchingClass(session: AdminMarketSession): string {
        switch (this.marketSessionBatchingStatus(session)) {
            case 'completed':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-500 dark:text-blue-50';
            case 'pending':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-500 dark:text-amber-50';
            default:
                return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-100';
        }
    }

    canBatchMarketSession(session: AdminMarketSession): boolean {
        return (
            this.canOpenMarketSessions() &&
            canRetryMarketSessionBatching(session)
        );
    }

    canPlanMarketSessionRoutes(session: AdminMarketSession): boolean {
        return (
            this.canOpenMarketSessions() &&
            this.marketSessionBatchingStatus(session) === 'completed'
        );
    }

    /** Creates or returns the proposed route plan for this market session. */
    planMarketSessionRoutes(session: AdminMarketSession): void {
        if (
            !this.canPlanMarketSessionRoutes(session) ||
            this.routingSessionId()
        ) {
            return;
        }
        this.routingSessionId.set(session.id);
        this.planningActionError.set(null);
        void this._logistics
            .planRoutes({
                marketSessionId: session.id,
                optimizationCriteria: this.routeCriteria.value,
            })
            .then(async (plan) => {
                this.marketSessionRoutePlan.set(plan);
                if (plan.status === 'empty' || plan.routes.length === 0) {
                    this._notifyKey(
                        'admin.orderGroups.marketSessions.routing.empty'
                    );
                    return;
                }
                this._snackBar.open(
                    this._transloco.translate(
                        'admin.orderGroups.marketSessions.routing.success',
                        { count: plan.routes.length }
                    ),
                    undefined,
                    { duration: 3500 }
                );
                this.marketSessionRoutes.set(
                    await this._loadMarketSessionRouteViews(session)
                );
            })
            .catch(async (err) => {
                const message = await this._describeRoutePlanningError(
                    err,
                    session
                );
                this.planningActionError.set(message);
                this._snackBar.open(message, undefined, { duration: 5000 });
            })
            .finally(() => this.routingSessionId.set(null));
    }

    /**
     * Approval is offered only where `ApproveRoutePlanCommandHandler` would
     * accept it: a proposal, with nothing left unassigned
     * (`PLAN_HAS_UNASSIGNED_ORDERS` is a refusal, not a warning). The handler's
     * remaining gates — a changed input revision, a route without a suggested
     * vehicle — cannot be seen from here and stay the server's to answer.
     */
    canApproveMarketSessionRoutePlan(): boolean {
        const plan = this.marketSessionRoutePlan();
        return (
            !!plan?.planId &&
            plan.status.toLowerCase() === 'proposed' &&
            plan.unassigned.length === 0
        );
    }

    /**
     * Planning is finished once the plan is approved. On a fresh dialog open
     * the plan DTO is not available, so the persisted route lifecycle is the
     * fallback: approval moves every planned route to `reviewed` and reserves
     * its suggested vehicle.
     */
    showMarketSessionRoutePlanningControls(): boolean {
        if (this.marketSessionRoutesLoading()) return false;
        if (
            this.marketSessionRoutePlan()?.status.toLowerCase() === 'approved'
        ) {
            return false;
        }
        return !this.marketSessionRoutes().some(({ route }) =>
            ['reviewed', 'assigned', 'in_progress', 'completed'].includes(
                this._routeStatus(route)
            )
        );
    }

    /**
     * The session's failed stops, for the reports tab.
     *
     * A driver reporting one is the third kind of report a session collects —
     * beside the agents' purchase exceptions and the hub's receiving
     * discrepancies — and the only one with no list endpoint of its own. It is
     * assembled here because the dialog already walks the day's routes and
     * their deliveries when it opens; the reports tab turns each stop into a
     * row by reading the order it cancelled.
     */
    readonly marketSessionFailedDeliveries = computed<SessionFailedDelivery[]>(
        () =>
            this.marketSessionRoutes().flatMap((view, routeIndex) => {
                const crew = this.routeCrew(view.route);
                const routeLabel = this._transloco.translate(
                    'admin.orderGroups.marketSessions.routing.routeNumber',
                    { number: routeIndex + 1 }
                );
                return view.deliveries
                    .filter(
                        (delivery) =>
                            delivery.status.trim().toLowerCase() === 'failed'
                    )
                    .map((delivery) => ({
                        deliveryId: delivery.deliveryId,
                        orderId: delivery.orderId,
                        routeLabel,
                        driverName: crew?.driverName ?? null,
                        at: delivery.actualArrival ?? null,
                        proofUrl: delivery.proofUrl ?? null,
                    }));
            })
    );

    /**
     * Whether the "create a plan" controls belong to the empty state rather
     * than to the toolbar above it.
     *
     * They live wherever the pane is actually asking for the action: with no
     * routes and no proposal on screen the whole tab is one empty state, and a
     * toolbar button above an empty box asks the question twice. Once there is
     * something to re-plan, they go back to the toolbar.
     */
    planningControlsInEmptyState(): boolean {
        return (
            this.showMarketSessionRoutePlanningControls() &&
            !this.marketSessionRoutesLoading() &&
            this.marketSessionRoutes().length === 0 &&
            !this.marketSessionRoutePlan()
        );
    }

    /**
     * What stands between this session and a delivery plan, as an i18n key —
     * `null` when nothing does and the action is simply waiting to be taken.
     *
     * Only one thing ever does: routing runs off batched orders, so a session
     * the system has not gathered into a lô yet has nothing to route. Said
     * plainly in the empty state, because a disabled button with no reason
     * reads as a broken screen.
     */
    marketSessionRoutingBlocker(session: AdminMarketSession): string | null {
        return this.marketSessionBatchingStatus(session) === 'completed'
            ? null
            : 'admin.orderGroups.marketSessions.routing.needsBatching';
    }

    /**
     * Why approval is withheld on a plan that otherwise looks ready, as an i18n
     * key — so the button's absence is explained rather than just felt.
     */
    marketSessionRoutePlanBlocker(): string | null {
        const plan = this.marketSessionRoutePlan();
        if (!plan?.planId) {
            return null;
        }
        const status = plan.status.toLowerCase();
        if (status === 'stale' || status === 'superseded') {
            return 'admin.orderGroups.marketSessions.routing.planSpent';
        }
        return status === 'proposed' && plan.unassigned.length > 0
            ? 'admin.orderGroups.marketSessions.routing.unassignedBlocks'
            : null;
    }

    approveMarketSessionRoutePlan(): void {
        const plan = this.marketSessionRoutePlan();
        const session = this.trackedMarketSession();
        if (
            !plan?.planId ||
            !session ||
            !this.canApproveMarketSessionRoutePlan() ||
            this.approvingRoutePlan()
        ) {
            return;
        }
        this.approvingRoutePlan.set(true);
        this.marketSessionRoutesError.set(null);
        void this._logistics
            .approveRoutePlan(plan.planId)
            .then(async (approved) => {
                this.marketSessionRoutePlan.set(approved);
                this.marketSessionRoutes.set(
                    await this._loadMarketSessionRouteViews(session)
                );
                this._notifyKey(
                    'admin.orderGroups.marketSessions.routing.approveSuccess'
                );
            })
            .catch(async (err) => {
                this.marketSessionRoutesError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.orderGroups.marketSessions.routing.approveError'
                    )
                );
                // `PLAN_STALE` is the server telling us it has just marked this
                // plan stale. Re-reading it replaces the spent proposal — and
                // its approve button — with the real state, instead of leaving
                // a button that can only fail the same way again.
                const info = await readApiError(err);
                if (info?.code === 'PLAN_STALE' && plan.planId) {
                    const refreshed = await this._logistics
                        .getRoutePlan(plan.planId)
                        .catch(() => null);
                    if (refreshed) {
                        this.marketSessionRoutePlan.set(refreshed);
                    }
                }
            })
            .finally(() => this.approvingRoutePlan.set(false));
    }

    // ── Dispatch: assign a truck and driver, then hand the load over ──────

    /** Vehicles and drivers for the tracked session's hub, read once per open. */
    readonly dispatchVehicles = signal<CrudRow[]>([]);
    readonly dispatchDrivers = signal<CrudRow[]>([]);
    readonly handovers = signal<CrudRow[]>([]);

    /** Which route's dispatch form is open, and what is picked in it. */
    readonly dispatchRouteId = signal<string | null>(null);
    readonly dispatchVehicleId = signal<string>('');
    readonly dispatchDriverId = signal<string>('');
    readonly dispatchNotes = signal<string>('');
    readonly dispatchBusy = signal(false);
    readonly dispatchError = signal<string | null>(null);

    /** Which optimizer the re-order buttons ask for. */
    readonly dispatchCriteria = signal<OptimizationCriterion>('distance');
    readonly optimizationCriteria = OPTIMIZATION_CRITERIA;

    private _routeStatus(route: CrudRow): string {
        return String(route['status'] ?? '').toLowerCase();
    }

    /**
     * `planned` → `selected`: adopts one calculated model as *the* route for
     * the day. Until this is pressed the route is a proposal, and every later
     * step refuses it.
     */
    canSelectRoute(route: CrudRow): boolean {
        return (
            this.canOpenMarketSessions() &&
            ['planned', 'draft', 'calculated'].includes(
                this._routeStatus(route)
            )
        );
    }

    /**
     * Re-orders the stops. Optional and repeatable — the route stays
     * `selected`, so an operator can try distance, look at the map, then try
     * time before locking the sequence in.
     */
    canOptimizeRoute(route: CrudRow): boolean {
        return (
            this.canOpenMarketSessions() &&
            this._routeStatus(route) === 'selected'
        );
    }

    /**
     * `selected` → `reviewed`: locks the stop order. The loading manifest is
     * only built from `reviewed` onwards — the warehouse cannot pack a route
     * whose sequence may still change.
     */
    canReviewRoute(route: CrudRow): boolean {
        return (
            this.canOpenMarketSessions() &&
            this._routeStatus(route) === 'selected'
        );
    }

    /**
     * A route can be crewed once its stop order is locked.
     * `AssignVehicleCommandHandler` re-runs its own eligibility check, so this
     * only decides whether to *offer* the form.
     *
     * `selected` is deliberately not here: the backend takes an assignment
     * only from `reviewed`, and offering the form a step early produced a
     * button whose sole outcome was a rejection.
     */
    canAssignRoute(route: CrudRow): boolean {
        return (
            this.canOpenMarketSessions() &&
            this._routeStatus(route) === 'reviewed'
        );
    }

    /**
     * The gate between the hub and the road. `CreateHandoverCommandHandler`
     * takes it only on an **assigned** route that already carries a driver —
     * the handover records who took the load out, so there is nothing to record
     * until someone has been put on it.
     */
    canHandOver(route: CrudRow): boolean {
        return (
            this.canOpenMarketSessions() &&
            String(route['status'] ?? '').toLowerCase() === 'assigned' &&
            !!this.routeDriverId(route)
        );
    }

    /** The driver already on the route — the only one a handover may name. */
    routeDriverId(route: CrudRow): string {
        return String(route['driverUserId'] ?? '');
    }

    /**
     * The crew on a route, or null while it has none.
     *
     * The route card used to say only that a route was `assigned`, so who was
     * driving it could be read in exactly one place: the dispatch form, which
     * has to be reopened per route and shows a *picker* rather than a record.
     *
     * Off-roster is asserted only against a roster that has actually been read
     * — an empty list means "not loaded yet", and calling that a missing driver
     * would put a warning on every route for the moment before the rosters
     * land.
     */
    routeCrew(route: CrudRow): RouteCrew | null {
        const driverId = this.routeDriverId(route);
        const vehicleId = String(route['vehicleId'] ?? '');
        if (!driverId && !vehicleId) {
            return null;
        }
        const drivers = this.dispatchDrivers();
        const vehicles = this.dispatchVehicles();
        const driver = drivers.find((row) => row.id === driverId) ?? null;
        const vehicle = vehicles.find((row) => row.id === vehicleId) ?? null;
        return {
            driverId,
            driverName: driver
                ? driverOptionLabel(driver)
                : `#${this.shortOrderId(driverId)}`,
            driverEmail: String(driver?.['email'] ?? '').trim(),
            driverInactive: !!driver && driver['isActive'] === false,
            driverOffRoster: !!driverId && !driver && drivers.length > 0,
            vehicleId,
            vehicleName: vehicle
                ? this.vehicleLabel(vehicle)
                : `#${this.shortOrderId(vehicleId)}`,
            vehicleOffRoster: !!vehicleId && !vehicle && vehicles.length > 0,
        };
    }

    openDispatch(route: CrudRow): void {
        this.dispatchRouteId.set(route.id);
        this.dispatchError.set(null);
        this.dispatchVehicleId.set(String(route['vehicleId'] ?? ''));
        this.dispatchDriverId.set(this.routeDriverId(route));
        this.dispatchNotes.set('');
        this.dispatchEligibility.set(null);
        void this._loadDispatchOptions().then(() =>
            this._checkEligibility(route.id)
        );
    }

    closeDispatch(): void {
        this.dispatchRouteId.set(null);
        this.dispatchError.set(null);
        this.dispatchEligibility.set(null);
    }

    /**
     * The busy / error / notify / re-read shell every lifecycle step needs.
     * Written once because the four of them differ only in the call they make
     * and the two keys they report with.
     */
    private _runDispatchStep(step: string, work: () => Promise<unknown>): void {
        if (this.dispatchBusy()) {
            return;
        }
        this.dispatchBusy.set(true);
        this.dispatchError.set(null);
        void work()
            .then(async () => {
                this._notifyKey(
                    `admin.orderGroups.marketSessions.dispatch.${step}Success`
                );
                await this._refreshDispatch();
            })
            .catch(async (err) => {
                this.dispatchError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        `admin.orderGroups.marketSessions.dispatch.${step}Error`
                    )
                );
            })
            .finally(() => this.dispatchBusy.set(false));
    }

    /** `planned` → `selected`. */
    selectRoute(route: CrudRow): void {
        this._runDispatchStep('select', () =>
            this._logistics.selectRoute(route.id)
        );
    }

    /** Re-orders the stops; the route stays `selected` so this can repeat. */
    optimizeRoute(route: CrudRow): void {
        this._runDispatchStep('optimize', () =>
            this._logistics.optimizeRoute(route.id, this.dispatchCriteria())
        );
    }

    /** `selected` → `reviewed`, approving the optimizer's order as it stands. */
    reviewRoute(route: CrudRow): void {
        this._runDispatchStep('review', () =>
            this._logistics.reviewRoute(route.id)
        );
    }

    /**
     * Why an assignment would be refused, *before* it is attempted — capacity,
     * double-booking, driver status. Read-only, so it costs nothing to ask on
     * every change of truck or driver, and it turns a rejected POST into an
     * answer the operator can act on while the form is still open.
     */
    readonly dispatchEligibility = signal<RouteEligibility | null>(null);

    private _checkEligibility(routeId: string): void {
        const vehicleId = this.dispatchVehicleId();
        if (!vehicleId) {
            this.dispatchEligibility.set(null);
            return;
        }
        void this._logistics
            .checkEligibility(routeId, vehicleId, this.dispatchDriverId())
            .then((result) => this.dispatchEligibility.set(result))
            .catch(() => this.dispatchEligibility.set(null));
    }

    /** Re-checks after the operator changes either half of the crew. */
    pickDispatchVehicle(routeId: string, vehicleId: string): void {
        this.dispatchVehicleId.set(vehicleId);
        this._checkEligibility(routeId);
    }

    pickDispatchDriver(routeId: string, driverUserId: string): void {
        this.dispatchDriverId.set(driverUserId);
        this._checkEligibility(routeId);
    }

    /** Puts a truck and a driver on the route (`reviewed` → `assigned`). */
    assignRouteCrew(route: CrudRow): void {
        const vehicleId = this.dispatchVehicleId();
        const driverUserId = this.dispatchDriverId();
        if (!vehicleId || !driverUserId || this.dispatchBusy()) {
            return;
        }
        this.dispatchBusy.set(true);
        this.dispatchError.set(null);
        void this._logistics
            .assignVehicle(route.id, vehicleId, driverUserId)
            .then(async () => {
                this._notifyKey(
                    'admin.orderGroups.marketSessions.dispatch.assignSuccess'
                );
                await this._refreshDispatch();
                this.closeDispatch();
            })
            .catch(async (err) => {
                this.dispatchError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.orderGroups.marketSessions.dispatch.assignError'
                    )
                );
            })
            .finally(() => this.dispatchBusy.set(false));
    }

    /** Records the driver taking the load out of the hub. */
    handOverRoute(route: CrudRow): void {
        const session = this.trackedMarketSession();
        const driverUserId = this.routeDriverId(route);
        if (!session?.hubId || !driverUserId || this.dispatchBusy()) {
            return;
        }
        this.dispatchBusy.set(true);
        this.dispatchError.set(null);
        void this._logistics
            .createHandover(
                session.hubId,
                route.id,
                driverUserId,
                this.dispatchNotes()
            )
            .then(async () => {
                this._notifyKey(
                    'admin.orderGroups.marketSessions.dispatch.handoverSuccess'
                );
                this.dispatchNotes.set('');
                await this._refreshDispatch();
            })
            .catch(async (err) => {
                this.dispatchError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.orderGroups.marketSessions.dispatch.handoverError'
                    )
                );
            })
            .finally(() => this.dispatchBusy.set(false));
    }

    /** Label for a driver row, falling back to the id when unnamed. */
    driverLabel(driver: CrudRow): string {
        return driverOptionLabel(driver);
    }

    vehicleLabel(vehicle: CrudRow): string {
        const plate = String(vehicle['plateNumber'] ?? '').trim();
        const capacity = vehicle['capacityKg'];
        return capacity ? `${plate} · ${capacity} kg` : plate;
    }

    /** Handovers already recorded for a route, newest first. */
    routeHandovers(route: CrudRow): CrudRow[] {
        return this.handovers().filter(
            (row) => String(row['deliveryRouteId'] ?? '') === route.id
        );
    }

    private async _loadDispatchOptions(): Promise<void> {
        const session = this.trackedMarketSession();
        if (!session?.hubId) {
            return;
        }
        const [vehicles, drivers, handovers] = await Promise.all([
            this._logistics.listVehicles(session.hubId).catch(() => []),
            this._logistics.getEligibleDrivers(session.hubId).catch(() => []),
            this._logistics.getHandovers(session.hubId).catch(() => []),
        ]);
        this.dispatchVehicles.set(vehicles);
        this.dispatchDrivers.set(drivers);
        // A route may still reference a driver who has since been removed from
        // this hub's roster. Do not keep that stale id invisibly selected: the
        // operator must choose from the current market/hub driver list.
        if (
            this.dispatchDriverId() &&
            !drivers.some((driver) => driver.id === this.dispatchDriverId())
        ) {
            this.dispatchDriverId.set('');
        }
        this.handovers.set(handovers);
    }

    /** Re-reads the routes so a status change lands, then the handover list. */
    private async _refreshDispatch(): Promise<void> {
        const session = this.trackedMarketSession();
        if (!session) {
            return;
        }
        this.marketSessionRoutes.set(
            await this._loadMarketSessionRouteViews(session)
        );
        await this._loadDispatchOptions();
    }

    marketSessionRouteStatusLabel(route: CrudRow): string {
        return this._transloco.translate(
            routeStatusLabelKey(String(route['status'] ?? ''))
        );
    }

    marketSessionRouteStatusClass(route: CrudRow): string {
        return routeStatusPillClass(String(route['status'] ?? ''));
    }

    marketSessionRouteNumber(route: CrudRow, key: string): number {
        const value = Number(route[key] ?? 0);
        return Number.isFinite(value) ? value : 0;
    }

    marketSessionRouteStops(route: CrudRow): RouteStop[] {
        return Array.isArray(route['stops'])
            ? (route['stops'] as RouteStop[])
            : [];
    }

    /**
     * Every order assigned to a route, even before delivery snapshots exist.
     * A proposed plan carries exact order ids; after approval the loading
     * manifest carries them. The session orders + restaurant stops are the
     * fallback when the dialog has just been reopened.
     */
    marketSessionRouteOrderStatuses(
        view: MarketSessionRouteView
    ): MarketSessionRouteOrderView[] {
        const trackingOrders = this.marketSessionTracking()?.orders ?? [];
        const trackingById = new Map(
            trackingOrders.map((order) => [order.orderId, order])
        );
        const deliveryByOrderId = new Map(
            view.deliveries.map((delivery) => [delivery.orderId, delivery])
        );
        const restaurantNameByOrderId = new Map<string, string>();

        const add = (orderId: unknown, restaurantName: unknown): void => {
            const id = String(orderId ?? '').trim();
            if (!id) return;
            const name = String(restaurantName ?? '').trim();
            if (name || !restaurantNameByOrderId.has(id)) {
                restaurantNameByOrderId.set(id, name);
            }
        };

        const plannedRoute = this.marketSessionRoutePlan()?.routes.find(
            (route) => route.id === view.route.id
        );
        const plannedStops = Array.isArray(plannedRoute?.['stops'])
            ? (plannedRoute['stops'] as Record<string, unknown>[])
            : [];
        for (const stop of plannedStops) {
            const orderIds = Array.isArray(stop['orderIds'])
                ? stop['orderIds']
                : [];
            for (const orderId of orderIds) {
                add(orderId, stop['restaurantName']);
            }
        }

        for (const stop of view.manifest?.stops ?? []) {
            for (const line of stop.lines) {
                add(line.orderId, stop.restaurantName);
            }
        }

        const restaurantIds = new Set(
            this.marketSessionRouteStops(view.route)
                .filter(
                    (stop) =>
                        String(stop.entityType).toLowerCase() === 'restaurant'
                )
                .map((stop) => String(stop.entityId))
        );
        for (const order of trackingOrders) {
            if (restaurantIds.has(order.restaurantId)) {
                add(order.orderId, order.restaurantName);
            }
        }

        for (const delivery of view.deliveries) {
            add(delivery.orderId, this.trackingOrderName(delivery.orderId));
        }

        return [...restaurantNameByOrderId].map(([orderId, restaurantName]) => {
            const order = trackingById.get(orderId);
            return {
                orderId,
                restaurantName:
                    restaurantName ||
                    order?.restaurantName ||
                    this.trackingOrderName(orderId),
                orderStatus: order?.status ?? '',
                delivery: deliveryByOrderId.get(orderId) ?? null,
            };
        });
    }

    deliveryStatusLabel(status: string): string {
        const key = `admin.orderGroups.marketSessions.routing.deliveryStatus.${String(status).toLowerCase()}`;
        const translated = this._transloco.translate(key);
        return translated === key ? status : translated;
    }

    trackingOrderName(orderId: string): string {
        const order = this.marketSessionTracking()?.orders.find(
            (item) => item.orderId === orderId
        );
        return order?.restaurantName || `#${this.shortOrderId(orderId)}`;
    }

    private async _loadMarketSessionRouteViews(
        session: AdminMarketSession
    ): Promise<MarketSessionRouteView[]> {
        if (!session.hubId) return [];
        const rows: CrudRow[] = [];
        let cursor: string | undefined;
        do {
            const page = await this._logistics.listRoutes({
                serviceDate: session.serviceDate,
                hubId: session.hubId,
                cursor,
            });
            rows.push(...page.rows);
            cursor = page.nextCursor;
        } while (cursor);

        return Promise.all(
            activeMarketSessionRouteRows(rows).map(async (row) => {
                const route = (await this._logistics.getRoute(row.id)) ?? row;
                const status = String(route['status'] ?? '').toLowerCase();
                const [deliveries, manifest] = await Promise.all([
                    this._logistics.getRouteDeliveries(row.id).catch(() => []),
                    [
                        'reviewed',
                        'assigned',
                        'in_progress',
                        'completed',
                    ].includes(status)
                        ? this._logistics
                              .getLoadingManifest(row.id)
                              .catch(() => null)
                        : Promise.resolve(null),
                ]);
                return { route, deliveries, manifest };
            })
        );
    }

    private async _describeRoutePlanningError(
        err: unknown,
        session: AdminMarketSession
    ): Promise<string> {
        const info = await readApiError(err);
        if (info?.code !== 'MISSING_COORDINATES') {
            return describeApiError(
                err,
                (key) => this._transloco.translate(key),
                'admin.orderGroups.marketSessions.routing.error'
            );
        }

        // BE deliberately includes the offending entity id in this message.
        // Preserve that precision instead of replacing it with the generic
        // MISSING_COORDINATES translation used by the rest of Logistics.
        const restaurantId = info.message?.match(
            /Restaurant '([^']+)' has no coordinates/i
        )?.[1];
        if (restaurantId) {
            const profile = await this._admin
                .getRestaurantProfile(restaurantId)
                .catch(() => null);
            return this._transloco.translate(
                'admin.orderGroups.marketSessions.routing.missingRestaurantCoordinates',
                {
                    name:
                        profile?.name?.trim() ||
                        `#${this.shortOrderId(restaurantId)}`,
                }
            );
        }

        const hubId = info.message?.match(
            /Hub '([^']+)' has no coordinates/i
        )?.[1];
        if (hubId) {
            return this._transloco.translate(
                'admin.orderGroups.marketSessions.routing.missingHubCoordinates',
                {
                    market: this.marketSessionName(session),
                    id: this.shortOrderId(hubId),
                }
            );
        }

        return this._transloco.translate('errors.api.missingCoordinates');
    }

    /**
     * Retries BE batching for the session's delivery date. The endpoint is
     * date-scoped and processes every closed, pending session on that date;
     * the selected session is then re-read so `batchingCompletedAt` remains
     * the authority for whether this attempt actually finished.
     */
    batchMarketSession(session: AdminMarketSession): void {
        if (!this.canBatchMarketSession(session) || this.batchingSessionId()) {
            return;
        }
        this.batchingSessionId.set(session.id);
        this.planningActionError.set(null);
        this._admin
            .runAutoBatch({
                targetDate: session.serviceDate,
                dryRun: false,
            })
            .then(async (result) => {
                const updated = await this._admin.getMarketSession(session.id);
                this.marketSessions.update((sessions) =>
                    sessions.map((item) =>
                        item.id === updated.id ? updated : item
                    )
                );
                if (this.trackedMarketSession()?.id === updated.id) {
                    this.trackedMarketSession.set(updated);
                    this.marketSessionTracking.update((tracking) =>
                        tracking ? { ...tracking, session: updated } : tracking
                    );
                }
                this.autoBatchResult.set(result);
                if (updated.batchingCompletedAt) {
                    this._notifyKey(
                        'admin.orderGroups.marketSessions.batching.success'
                    );
                } else {
                    this.planningActionError.set(
                        this._transloco.translate(
                            'admin.orderGroups.marketSessions.batching.stillPending'
                        )
                    );
                }
                this._load();
                this._loadPlanning();
                if (this.trackedMarketSession()?.id === updated.id) {
                    this.refreshMarketSessionTracking();
                }
            })
            .catch(async (err) => {
                const message = await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'admin.orderGroups.marketSessions.batching.error'
                );
                this.planningActionError.set(message);
                this._snackBar.open(message, undefined, { duration: 5000 });
                this._loadPlanning();
            })
            .finally(() => this.batchingSessionId.set(null));
    }

    marketSessionReadinessLabel(session: AdminMarketSession): string {
        return this._transloco.translate(
            `admin.orderGroups.marketSessions.readiness.${session.readiness}`
        );
    }

    marketSessionWarningLabel(code: string): string {
        const knownCodes = new Set([
            'BATCHING_DISABLED',
            'HUB_NOT_CONFIGURED',
            'NO_MARKET_AGENT',
            'NO_VEHICLE',
        ]);
        return knownCodes.has(code)
            ? this._transloco.translate(
                  `admin.orderGroups.marketSessions.warning.${code}`
              )
            : code;
    }

    formatSessionCloseTime(value: string): string {
        const date = DateTime.fromISO(value).setZone(VIETNAM_ZONE);
        return date.isValid
            ? date
                  .setLocale(this._transloco.getActiveLang())
                  .toFormat('HH:mm, dd/MM/yyyy')
            : '—';
    }

    formatMarketSessionServiceDate(value: string): string {
        const date = DateTime.fromISO(value, { zone: VIETNAM_ZONE });
        return date.isValid
            ? date.setLocale(this._transloco.getActiveLang()).toLocaleString({
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
              })
            : value;
    }

    trackingOrderStatusLabel(status: string | null | undefined): string {
        const raw = String(status ?? '').toLowerCase();
        const normalized =
            {
                athub: 'at_hub',
                pickedup: 'ready_for_pickup',
                delivering: 'in_transit',
            }[raw] ?? raw;
        if (!normalized) return '—';
        const key = `admin.orders.status.${normalized}`;
        const translated = this._transloco.translate(key);
        return translated === key ? String(status) : translated;
    }

    marketSessionInboundStatusLabel(status: string | null | undefined): string {
        const normalized = String(status ?? '').toLowerCase();
        if (!normalized) return '—';
        const key = `admin.orderGroups.marketSessions.tracking.inbound.status.${normalized}`;
        const translated = this._transloco.translate(key);
        return translated === key ? String(status) : translated;
    }

    marketSessionInboundStatusClass(status: string | null | undefined): string {
        return String(status ?? '').toUpperCase() === 'ARRIVED_AT_HUB'
            ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200'
            : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200';
    }

    trackingMoney(value: number | null | undefined): string {
        return new Intl.NumberFormat(this._transloco.getActiveLang(), {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(Number(value ?? 0));
    }

    /** Totals per unit of measure — quantities only add up within a unit. */
    private _quantityTotals(
        products: AdminMarketSessionProductSummary[] | undefined
    ): { unit: string; total: number }[] {
        const totals = new Map<string, number>();
        for (const product of products ?? []) {
            const unit = this.trackingProductUnit(product);
            totals.set(unit, (totals.get(unit) ?? 0) + product.totalQuantity);
        }
        return [...totals].map(([unit, total]) => ({ unit, total }));
    }

    trackingProductUnit(product: TrackingCatalogFields): string {
        return String(
            product.unitAbbreviation || product.unitName || product.unit || ''
        ).trim();
    }

    planningDayLabel(day: PlanningDay): string {
        if (day.iso === this._localToday.toISODate()) {
            return this._transloco.translate(
                'admin.orderGroups.planning.today'
            );
        }
        if (day.iso === this.tomorrowDate.toISODate()) {
            return this._transloco.translate(
                'admin.orderGroups.planning.tomorrow'
            );
        }
        return day.date
            .setLocale(this._transloco.getActiveLang())
            .toFormat('cccc');
    }

    membersOf(row: AdminOrderGroupRow): AdminBatchMember[] {
        return Array.isArray(row['members'])
            ? (row['members'] as AdminBatchMember[])
            : [];
    }

    shortOrderId(value: string | null | undefined): string {
        const id = String(value ?? '');
        return id ? id.slice(0, 8).toUpperCase() : '—';
    }

    private async _enrichMarketSessionTracking(
        tracking: AdminMarketSessionTracking
    ): Promise<AdminMarketSessionTracking> {
        const ordersWithAddresses = await Promise.all(
            tracking.orders.map(async (order) => ({
                ...order,
                restaurantAddress: await this._restaurantAddress(
                    order.restaurantId
                ),
            }))
        );
        const trackingWithAddresses = {
            ...tracking,
            orders: ordersWithAddresses,
        };
        try {
            const [listings, categories] = await Promise.all([
                this._catalogAdmin.listMarketProducts(
                    tracking.session.marketId
                ),
                this._catalogAdmin.listCategories(false),
            ]);
            const text = (value: unknown): string => String(value ?? '').trim();
            const categoryByName = new Map(
                categories
                    .filter((category) => text(category['name']))
                    .map((category) => [
                        text(category['name']).toLocaleLowerCase('vi'),
                        category,
                    ])
            );
            const listingById = new Map(
                listings
                    .map(
                        (listing) =>
                            [
                                text(
                                    listing['marketProductId'] ?? listing['id']
                                ),
                                listing,
                            ] as const
                    )
                    .filter(([id]) => !!id)
            );
            const enrich = <T extends TrackingCatalogFields>(item: T): T => {
                const listing = listingById.get(item.marketProductId);
                const sellingUnit =
                    listing?.['sellingUnit'] &&
                    typeof listing['sellingUnit'] === 'object'
                        ? (listing['sellingUnit'] as Record<string, unknown>)
                        : null;
                const unit =
                    this.trackingProductUnit(item) ||
                    text(listing?.['unit']) ||
                    text(sellingUnit?.['unitName']);
                const categoryName =
                    text(item.categoryName) || text(listing?.['category']);
                const category = categoryByName.get(
                    categoryName.toLocaleLowerCase('vi')
                );
                return {
                    ...item,
                    unit: text(item.unit) || unit,
                    unitName: text(item.unitName) || unit,
                    categoryId: text(item.categoryId) || text(category?.['id']),
                    categoryName,
                    parentCategoryId:
                        text(item.parentCategoryId) ||
                        text(category?.['parentId']),
                    parentCategoryName:
                        text(item.parentCategoryName) ||
                        text(category?.['parentName']),
                };
            };
            return {
                ...trackingWithAddresses,
                products: tracking.products.map(enrich),
                orders: ordersWithAddresses.map((order) => ({
                    ...order,
                    items: (order.items ?? []).map(enrich),
                })),
            };
        } catch {
            // Addresses remain visible if the catalog lookup is unavailable.
            return trackingWithAddresses;
        }
    }

    private _restaurantAddress(restaurantId: string): Promise<string | null> {
        const id = String(restaurantId ?? '').trim();
        if (!id) return Promise.resolve(null);
        let pending = this._restaurantAddressCache.get(id);
        if (!pending) {
            pending = this._admin
                .getRestaurantProfile(id)
                .then((profile) => profile?.address?.trim() || null)
                .catch(() => null);
            this._restaurantAddressCache.set(id, pending);
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

    /**
     * What the session invoiced, or `null` when an order behind it did not
     * load — a sum missing one of its orders is a smaller number, not a
     * smaller truth, and it reads as a real figure on the board.
     */
    historyGroupInvoice(row: AdminOrderGroupRow): number | null {
        const details = this.historyOrderDetails();
        let total = 0;
        for (const member of this.membersOf(row)) {
            const detail = details.get(String(member.orderId ?? ''));
            if (!detail) {
                return null;
            }
            total += Number(detail.totalAmount ?? 0);
        }
        return total;
    }

    /** Restaurants in the session, or `null` when an order did not load. */
    historyGroupRestaurantCount(row: AdminOrderGroupRow): number | null {
        const details = this.historyOrderDetails();
        const restaurants = new Set<string>();
        for (const member of this.membersOf(row)) {
            const detail = details.get(String(member.orderId ?? ''));
            if (!detail) {
                return null;
            }
            const restaurantId = String(detail.restaurantId ?? '');
            if (restaurantId) {
                restaurants.add(restaurantId);
            }
        }
        return restaurants.size;
    }

    /** Re-reads only the orders behind the history figures — the banner's retry. */
    reloadHistorySummary(): void {
        if (this.historySummaryLoading()) {
            return;
        }
        void this._loadHistoryOrderDetails(this.groups());
    }

    /** A figure, or the dash that stands for "could not be read". */
    historyCount(value: number | null): string {
        return value === null ? '—' : String(value);
    }

    historyGroupItemCount(row: AdminOrderGroupRow): number {
        return Number(
            row.itemCount ??
                row['totalItemCount'] ??
                (Array.isArray(row['items']) ? row['items'].length : 0)
        );
    }

    historyMoney(value: number | null): string {
        if (value === null) {
            return '—';
        }
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
        const { targetDate, dryRun } = this.batchForm.getRawValue();
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
            })
            .then((result) => {
                this.autoBatchResult.set(result);
                this.closeAutoBatch();
                if (!dryRun) {
                    this._notifyKey('admin.orderGroups.autoBatch.success');
                    this._load();
                    this._loadPlanning();
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

    resetConfirmationPhrase(): string {
        return (
            resetConfirmationPhraseForDate(
                this.resetForm.controls.targetDate.value
            ) ?? 'RESET yyyy-MM-dd'
        );
    }

    resetTargetDateLabel(): string {
        const targetDate = this.resetForm.controls.targetDate.value;
        return targetDate && targetDate.isValid
            ? targetDate.toFormat('dd/MM/yyyy')
            : '—';
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
            this.historySummaryFailed.set(false);
            return;
        }

        this.historySummaryLoading.set(true);
        this.historySummaryFailed.set(false);
        const details = new Map<string, AdminOrderDetail>();
        let missing = 0;
        try {
            for (
                let offset = 0;
                offset < ids.length;
                offset += HISTORY_ORDER_READ_CHUNK
            ) {
                const chunk = ids.slice(
                    offset,
                    offset + HISTORY_ORDER_READ_CHUNK
                );
                const results = await Promise.all(
                    chunk.map(async (id) => {
                        try {
                            return [
                                id,
                                await this._admin.getSettledOrder(id),
                            ] as const;
                        } catch {
                            return [id, null] as const;
                        }
                    })
                );
                for (const [id, detail] of results) {
                    if (detail) {
                        details.set(id, detail);
                    } else {
                        missing += 1;
                    }
                }
            }
            this.historyOrderDetails.set(details);
            this.historySummaryFailed.set(missing > 0);
        } finally {
            this.historySummaryLoading.set(false);
        }
    }

    private _loadPlanning(): void {
        this._loadPlanningTask.trigger();
    }

    private readonly _loadPlanningTask = new CoalescedTask(async () => {
        this.planningLoading.set(true);
        this.planningLoadFailed.set(false);
        try {
            const from = this._localToday.toISODate() ?? undefined;
            // operations_manager may list sessions but BE deliberately denies
            // operational settings. Admin uses the configured window; read-only
            // roles query all current/future sessions and infer the visible range.
            const settings = await this._admin
                .getOperationalSettings()
                .catch(() => null);
            const futureWindowDays = Math.min(
                30,
                Math.max(1, Number(settings?.deliveryWindowDays) || 7)
            );
            let visibleWindowDays = futureWindowDays + 1;
            const to = settings
                ? this.tomorrowDate
                      .plus({ days: futureWindowDays - 1 })
                      .toISODate()
                : null;
            const sessions = await this._admin.getMarketSessions({
                from,
                to: to ?? undefined,
            });
            if (!settings && sessions.length) {
                const lastServiceDate = sessions.reduce(
                    (latest, session) =>
                        session.serviceDate > latest
                            ? session.serviceDate
                            : latest,
                    from ?? ''
                );
                const lastDay = DateTime.fromISO(lastServiceDate, {
                    zone: VIETNAM_ZONE,
                });
                if (lastDay.isValid) {
                    visibleWindowDays = Math.min(
                        31,
                        Math.max(
                            1,
                            Math.floor(
                                lastDay.diff(this._localToday, 'days').days
                            ) + 1
                        )
                    );
                }
            }
            this.planningWindowDays.set(visibleWindowDays);
            this.marketSessions.set(
                [...sessions].sort(
                    (left, right) =>
                        left.serviceDate.localeCompare(right.serviceDate) ||
                        this.marketSessionName(left).localeCompare(
                            this.marketSessionName(right)
                        )
                )
            );
        } catch {
            this.marketSessions.set([]);
            this.planningLoadFailed.set(true);
        } finally {
            this.planningLoading.set(false);
        }
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
