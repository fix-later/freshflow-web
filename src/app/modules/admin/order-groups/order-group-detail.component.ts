import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    TemplateRef,
    ViewEncapsulation,
    WritableSignal,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { AdminService } from '../admin.service';
import {
    AdminBatchItem,
    AdminBatchMember,
    AdminMarketSessionTrackingOrder,
    AdminOrderDetail,
    AdminOrderGroupRow,
    AdminOrderItem,
    AdminUserRow,
} from '../admin.types';
import { CatalogAdminService } from '../catalog/catalog-admin.service';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { RouteDeliveryStatus } from '../logistics/logistics-admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { CrudRow } from '../shared/resource-crud.types';
import {
    canCancelBatch,
    canGenerateManifest,
    statusLabelKey,
    statusPillClass,
} from './order-group-status';

/** Label + value pair for curated detail grids. */
export interface DetailField {
    label: string;
    value: string;
}

interface SessionRouteDetail {
    route: CrudRow;
    deliveries: RouteDeliveryStatus[];
}

interface SessionEvidence {
    id: string;
    url: string;
    title: string;
    meta: string;
    source: 'driver' | 'market_agent' | 'hub';
}

/**
 * Admin ▸ Order groups ▸ Detail — curated overview of one procurement batch
 * (summary, items, member orders, exceptions).
 */
@Component({
    selector: 'admin-order-group-detail',
    templateUrl: './order-group-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col admin-order-group-detail' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatTabsModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
    styles: [
        `
            /* Fill remaining height under the page header — Fuse tab layout. */
            .admin-order-group-detail {
                .mat-mdc-tab-group,
                .mat-mdc-tab-body-wrapper,
                .mat-mdc-tab-body,
                .mat-mdc-tab-body-content {
                    display: flex;
                    flex: 1 1 auto;
                    flex-direction: column;
                    min-height: 0;
                }

                .mat-mdc-tab-body-content {
                    overflow: auto;
                }

                .mat-mdc-tab .mdc-tab__text-label {
                    font-size: 0.9375rem;
                    font-weight: 600;
                }

                .order-group-items-grid {
                    grid-template-columns:
                        minmax(0, 1.4fr) minmax(0, 0.7fr) minmax(0, 0.9fr)
                        minmax(0, 0.7fr) minmax(0, 0.9fr) minmax(0, 1.1fr);
                }

                .order-group-orders-grid {
                    grid-template-columns:
                        minmax(0, 1.15fr) minmax(0, 1.1fr) minmax(0, 0.85fr)
                        minmax(0, 0.85fr) minmax(0, 0.85fr) minmax(0, 1fr)
                        2.75rem;

                    @screen lg {
                        grid-template-columns:
                            minmax(0, 1.15fr) minmax(0, 1.2fr) minmax(0, 0.8fr)
                            minmax(0, 0.85fr) minmax(0, 0.75fr) minmax(0, 0.9fr)
                            minmax(0, 1fr) 2.75rem;
                    }
                }

                .order-group-order-items-grid {
                    grid-template-columns:
                        minmax(0, 1.5fr) minmax(0, 0.6fr) minmax(0, 0.9fr)
                        minmax(0, 0.9fr) minmax(0, 0.7fr);
                }
            }
        `,
    ],
})
export class OrderGroupDetailComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);
    private readonly _dialog = inject(MatDialog);
    private readonly _snackBar = inject(MatSnackBar);

    private _cancelDialogRef: MatDialogRef<unknown> | null = null;

    readonly statusPillClass = statusPillClass;

    readonly batch = signal<AdminOrderGroupRow | null>(null);
    readonly loading = signal(false);
    readonly notFound = signal(false);
    readonly manifesting = signal(false);
    readonly cancelSaving = signal(false);
    readonly cancelReason = new FormControl('', { nonNullable: true });

    /** id → name lookups so ids resolve to names in the field grid. */
    readonly marketNames = signal<Map<string, string>>(new Map());
    readonly hubNames = signal<Map<string, string>>(new Map());
    readonly agentNames = signal<Map<string, string>>(new Map());
    readonly usersById = signal<Map<string, AdminUserRow>>(new Map());
    readonly restaurantNames = signal<Map<string, string>>(new Map());
    readonly vehiclesById = signal<Map<string, CrudRow>>(new Map());
    readonly productUnits = signal<Map<string, string>>(new Map());
    private _loadedUnitMarketId = '';

    /** Member order drill-down: open ids, fetched-detail cache, in-flight ids. */
    readonly expandedOrders = signal<Set<string>>(new Set());
    readonly orderDetails = signal<Map<string, AdminOrderDetail>>(new Map());
    readonly loadingOrders = signal<Set<string>>(new Set());
    /** True while member orders are being prefetched for the Orders tab. */
    readonly ordersPrefetching = signal(false);
    readonly sessionContextLoading = signal(false);
    readonly sessionRoutes = signal<SessionRouteDetail[]>([]);
    readonly sessionResourceVehicleIds = signal<string[]>([]);
    readonly hubDiscrepancies = signal<CrudRow[]>([]);

    readonly batchId = computed(() => this.batch()?.id ?? '');
    /** Header title — batch id (UUID). */
    readonly detailTitle = computed(
        () =>
            String(this.batch()?.batchNumber ?? '').trim() ||
            this.batchId() ||
            this._transloco.translate('admin.orderGroups.detailPage.title')
    );
    readonly canManifest = computed(() =>
        canGenerateManifest(this.batch()?.status)
    );
    readonly canCancel = computed(() => canCancelBatch(this.batch()?.status));

    readonly itemCount = computed(() => this.itemsOf(this.batch()).length);
    readonly memberCount = computed(() => this.membersOf(this.batch()).length);
    readonly exceptionCount = computed(
        () => this.exceptionsOf(this.batch()).length
    );

    /** Financial and volume roll-ups calculated from the fetched member orders. */
    readonly loadedOrders = computed(() => [...this.orderDetails().values()]);
    readonly restaurantCount = computed(
        () =>
            new Set(
                this.loadedOrders()
                    .map((order) => String(order.restaurantId ?? ''))
                    .filter(Boolean)
            ).size
    );
    readonly totalOrderValue = computed(() =>
        this.loadedOrders().reduce(
            (sum, order) => sum + Number(order.totalAmount ?? 0),
            0
        )
    );
    readonly totalMerchandiseValue = computed(() =>
        this.loadedOrders().reduce((sum, order) => {
            const storedSubtotal = Number(order.subtotalAmount ?? 0);
            const itemSubtotal = this.orderItemsOf(order).reduce(
                (itemSum, item) => itemSum + Number(item.subtotal ?? 0),
                0
            );
            return sum + (storedSubtotal || itemSubtotal);
        }, 0)
    );
    readonly totalOrderLines = computed(() =>
        this.loadedOrders().reduce(
            (sum, order) => sum + this.orderItemsOf(order).length,
            0
        )
    );
    readonly totalRequestedQuantity = computed(() =>
        this.loadedOrders().reduce(
            (sum, order) =>
                sum +
                this.orderItemsOf(order).reduce(
                    (lineSum, item) => lineSum + Number(item.quantity ?? 0),
                    0
                ),
            0
        )
    );
    readonly totalActualQuantity = computed(() =>
        this.loadedOrders().reduce(
            (sum, order) =>
                sum +
                this.orderItemsOf(order).reduce(
                    (lineSum, item) =>
                        lineSum + Number(item.actualQuantity ?? 0),
                    0
                ),
            0
        )
    );
    readonly referencePurchaseValue = computed(() =>
        this.itemsOf(this.batch()).reduce(
            (sum, item) =>
                sum +
                Number(item.totalQuantity ?? 0) *
                    Number(item.referenceUnitPrice ?? 0),
            0
        )
    );
    readonly actualPurchaseValue = computed(() =>
        this.itemsOf(this.batch()).reduce(
            (sum, item) =>
                sum +
                Number(item.actualQuantity ?? 0) *
                    Number(item.actualUnitPrice ?? 0),
            0
        )
    );
    readonly sessionVehicleIds = computed(() => {
        const ids = new Set(this.sessionResourceVehicleIds());
        for (const detail of this.sessionRoutes()) {
            const vehicleId = String(detail.route['vehicleId'] ?? '');
            if (vehicleId) ids.add(vehicleId);
        }
        return [...ids];
    });
    readonly sessionEvidence = computed<SessionEvidence[]>(() => {
        const evidence: SessionEvidence[] = [];
        const seen = new Set<string>();
        const push = (item: SessionEvidence): void => {
            if (!item.url || seen.has(item.url)) return;
            seen.add(item.url);
            evidence.push(item);
        };

        for (const order of this.loadedOrders()) {
            const url = String(order.proofUrl ?? '').trim();
            if (url) {
                push({
                    id: `order-${order.orderId ?? url}`,
                    url,
                    title: this._t(
                        'admin.orderGroups.historyDetail.driverProof'
                    ),
                    meta: `${this._t('admin.orderGroups.orderField.orderId')}: ${order.orderId ?? '—'}`,
                    source: 'driver',
                });
            }
        }
        for (const detail of this.sessionRoutes()) {
            for (const delivery of detail.deliveries) {
                const url = String(delivery.proofUrl ?? '').trim();
                if (!url) continue;
                push({
                    id: `delivery-${delivery.deliveryId || url}`,
                    url,
                    title: this._t(
                        'admin.orderGroups.historyDetail.driverProof'
                    ),
                    meta: `${this._t('admin.orderGroups.orderField.orderId')}: ${delivery.orderId || '—'}`,
                    source: 'driver',
                });
            }
        }
        for (const exception of this.exceptionsOf(this.batch())) {
            const url = String(exception['proofImageUrl'] ?? '').trim();
            if (!url) continue;
            push({
                id: `procurement-${String(exception['id'] ?? url)}`,
                url,
                title: this._t(
                    'admin.orderGroups.historyDetail.marketAgentProof'
                ),
                meta:
                    String(exception['note'] ?? '').trim() ||
                    this.exceptionTypeLabel(String(exception['type'] ?? '')),
                source: 'market_agent',
            });
        }
        for (const discrepancy of this.hubDiscrepancies()) {
            const url = String(discrepancy['proofImageUrl'] ?? '').trim();
            if (!url) continue;
            push({
                id: `hub-${discrepancy.id || url}`,
                url,
                title: this._t('admin.orderGroups.historyDetail.hubProof'),
                meta:
                    String(discrepancy['notes'] ?? '').trim() ||
                    String(discrepancy['conditionStatus'] ?? ''),
                source: 'hub',
            });
        }
        return evidence;
    });

    ngOnInit(): void {
        this._loadLookups();
        const id = this._route.snapshot.paramMap.get('batchId') ?? '';
        const passed = (history.state?.batch ??
            null) as AdminOrderGroupRow | null;
        if (passed && passed.id === id) {
            this.batch.set(passed);
            this._prefetchMemberOrders(passed);
            this._loadSessionContext(passed);
        } else if (id) {
            this._fetch(id);
        } else {
            this.notFound.set(true);
        }
    }

    goBack(): void {
        this._router.navigate(['/admin/order-groups/history']);
    }

    generateManifest(): void {
        const id = this.batchId();
        if (!id || !this.canManifest()) {
            return;
        }
        this.manifesting.set(true);
        this._admin
            .generateManifest(id)
            .then(() => {
                this._notifyKey('admin.orderGroups.manifest.success');
                this._fetch(id);
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.manifesting.set(false));
    }

    openCancel(template: TemplateRef<unknown>): void {
        if (!this.canCancel()) {
            return;
        }
        this.cancelReason.reset('');
        this.cancelSaving.set(false);
        this._cancelDialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._cancelDialogRef.afterClosed().subscribe(() => {
            this._cancelDialogRef = null;
        });
    }

    closeCancel(): void {
        this._cancelDialogRef?.close();
    }

    confirmCancel(): void {
        const id = this.batchId();
        if (!id) {
            return;
        }
        this.cancelSaving.set(true);
        this._admin
            .cancelOrderGroup(id, this.cancelReason.value.trim() || undefined)
            .then(() => {
                this._notifyKey('admin.orderGroups.cancel.success');
                this.closeCancel();
                this.goBack();
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.cancelSaving.set(false));
    }

    summaryCards(row: AdminOrderGroupRow): DetailField[] {
        const marketId = String(row.marketId ?? '');
        const hubId = String(row.hubId ?? '');
        const agentId = String(row.agentId ?? row['assignedAgentUserId'] ?? '');
        const orderCount =
            row.orderCount ??
            (Array.isArray(row['members']) ? row['members'].length : null);
        const itemCount =
            row.itemCount ??
            (row['totalItemCount'] as number | null | undefined) ??
            (Array.isArray(row['items']) ? row['items'].length : null);

        return [
            {
                label: this._t('admin.orderGroups.field.market'),
                value:
                    row.marketName ||
                    this.marketNames().get(marketId) ||
                    marketId ||
                    '—',
            },
            {
                label: this._t('admin.orderGroups.field.hub'),
                value: this.hubNames().get(hubId) || hubId || '—',
            },
            {
                label: this._t('admin.orderGroups.field.agent'),
                value:
                    row.agentEmail ||
                    this.agentNames().get(agentId) ||
                    agentId ||
                    this._t('admin.orderGroups.assignAgent.none'),
            },
            {
                label: this._t('admin.orderGroups.field.batchDate'),
                value:
                    this.formatDateShort(row['batchDate'] ?? row.createdAt) ||
                    '—',
            },
            {
                label: this._t('admin.orderGroups.field.orderCount'),
                value:
                    orderCount === null || orderCount === undefined
                        ? '—'
                        : String(orderCount),
            },
            {
                label: this._t('admin.orderGroups.field.totalItemCount'),
                value:
                    itemCount === null || itemCount === undefined
                        ? '—'
                        : String(itemCount),
            },
        ];
    }

    timelineEntries(row: AdminOrderGroupRow): DetailField[] {
        const entries: {
            key: string;
            labelKey: string;
            format?: 'date' | 'bool' | 'text';
        }[] = [
            {
                key: 'manifestedAt',
                labelKey: 'admin.orderGroups.field.manifestedAt',
                format: 'date',
            },
            {
                key: 'assignedAt',
                labelKey: 'admin.orderGroups.field.assignedAt',
                format: 'date',
            },
            {
                key: 'handedOffAt',
                labelKey: 'admin.orderGroups.field.handedOffAt',
                format: 'date',
            },
            {
                key: 'isCompleted',
                labelKey: 'admin.orderGroups.field.isCompleted',
                format: 'bool',
            },
            {
                key: 'cancelledAt',
                labelKey: 'admin.orderGroups.field.cancelledAt',
                format: 'date',
            },
            {
                key: 'cancellationReason',
                labelKey: 'admin.orderGroups.field.cancellationReason',
                format: 'text',
            },
        ];

        return entries
            .map(({ key, labelKey, format }) => {
                const raw = row[key];
                if (raw === null || raw === undefined || raw === '') {
                    return null;
                }
                let value = '—';
                if (format === 'date') {
                    value = this.formatDate(raw) || '—';
                } else if (format === 'bool') {
                    value =
                        raw === true
                            ? this._t('admin.orderGroups.yes')
                            : this._t('admin.orderGroups.no');
                } else {
                    value = String(raw);
                }
                if (value === '—') {
                    return null;
                }
                return { label: this._t(labelKey), value };
            })
            .filter((e): e is DetailField => e !== null);
    }

    orderSummaryEntries(detail: AdminOrderDetail): DetailField[] {
        return [
            {
                label: this._t('admin.orderGroups.orderField.restaurantId'),
                value: String(detail.restaurantId ?? '—'),
            },
            {
                label: this._t('admin.orderGroups.orderField.status'),
                value: this.statusLabel(detail.status),
            },
            {
                label: this._t('admin.orderGroups.orderField.paymentStatus'),
                value: this.paymentStatusLabel(detail.paymentStatus),
            },
            {
                label: this._t('admin.orderGroups.orderField.scheduledFor'),
                value: this.formatDate(detail.scheduledFor) || '—',
            },
            {
                label: this._t('admin.orderGroups.orderField.totalAmount'),
                value: this.money(detail.totalAmount),
            },
            {
                label: this._t('admin.orderGroups.orderField.notes'),
                value: String(detail.notes ?? '—') || '—',
            },
            {
                label: this._t('admin.orderGroups.orderField.createdAt'),
                value: this.formatDate(detail.createdAt) || '—',
            },
        ];
    }

    exceptionEntries(ex: Record<string, unknown>): DetailField[] {
        const type = ex['type'] ?? ex['exceptionType'];
        const fields: DetailField[] = [
            {
                label: this._t('admin.orderGroups.exception.type'),
                value: this.exceptionTypeLabel(
                    type === null || type === undefined ? null : String(type)
                ),
            },
            {
                label: this._t('admin.orderGroups.exception.reportedQuantity'),
                value: String(ex['reportedQuantity'] ?? '—'),
            },
            {
                label: this._t('admin.orderGroups.exception.note'),
                value: String(ex['note'] ?? ex['notes'] ?? '—') || '—',
            },
            {
                label: this._t('admin.orderGroups.exception.reportedAt'),
                value:
                    this.formatDate(ex['reportedAt'] ?? ex['createdAt']) || '—',
            },
        ];
        return fields.filter(
            (f) =>
                f.value !== '—' ||
                f.label === this._t('admin.orderGroups.exception.type')
        );
    }

    itemsOf(row: AdminOrderGroupRow | null): AdminBatchItem[] {
        const items = row?.['items'];
        return Array.isArray(items) ? (items as AdminBatchItem[]) : [];
    }

    membersOf(row: AdminOrderGroupRow | null): AdminBatchMember[] {
        const members = row?.['members'];
        return Array.isArray(members) ? (members as AdminBatchMember[]) : [];
    }

    exceptionsOf(row: AdminOrderGroupRow | null): Record<string, unknown>[] {
        const exceptions = row?.['exceptions'];
        return Array.isArray(exceptions)
            ? (exceptions as Record<string, unknown>[])
            : [];
    }

    isOrderExpanded(orderId: string | null | undefined): boolean {
        return !!orderId && this.expandedOrders().has(orderId);
    }

    isOrderLoading(orderId: string | null | undefined): boolean {
        return !!orderId && this.loadingOrders().has(orderId);
    }

    orderDetail(orderId: string | null | undefined): AdminOrderDetail | null {
        return orderId ? this.orderDetails().get(orderId) ?? null : null;
    }

    /** Merged member + fetched detail for the Orders inventory row. */
    orderStatus(member: AdminBatchMember): string | null | undefined {
        const detail = this.orderDetail(member.orderId);
        return detail?.status ?? member.status;
    }

    restaurantLabel(member: AdminBatchMember): string {
        const detail = this.orderDetail(member.orderId);
        const fromDetail = detail?.restaurantName?.trim();
        if (fromDetail) {
            return fromDetail;
        }
        const restaurantId = String(
            detail?.restaurantId ?? member['restaurantId'] ?? ''
        );
        if (!restaurantId) {
            return '—';
        }
        return this.restaurantNames().get(restaurantId) || restaurantId;
    }

    orderTotal(member: AdminBatchMember): string {
        const detail = this.orderDetail(member.orderId);
        return detail ? this.money(detail.totalAmount) : '—';
    }

    orderScheduled(member: AdminBatchMember): string {
        const detail = this.orderDetail(member.orderId);
        return detail ? this.formatDate(detail.scheduledFor) || '—' : '—';
    }

    orderPayment(member: AdminBatchMember): string {
        const detail = this.orderDetail(member.orderId);
        return detail ? this.paymentStatusLabel(detail.paymentStatus) : '—';
    }

    orderItemCount(member: AdminBatchMember): string {
        const detail = this.orderDetail(member.orderId);
        if (!detail) {
            return '—';
        }
        return String(this.orderItemsOf(detail).length);
    }

    orderItemsOf(detail: AdminOrderDetail | null): AdminOrderItem[] {
        const items = detail?.items;
        return Array.isArray(items) ? items : [];
    }

    itemUnit(marketProductId: string | null | undefined): string {
        return (
            this.productUnits().get(String(marketProductId ?? '')) ||
            this._t('admin.orderGroups.historyDetail.unitUnknown')
        );
    }

    participatingUserIds(row: AdminOrderGroupRow): string[] {
        const ids = new Set<string>();
        const assigned = String(
            row.agentId ?? row['assignedAgentUserId'] ?? ''
        );
        if (assigned) {
            ids.add(assigned);
        }
        for (const exception of this.exceptionsOf(row)) {
            const reporter = String(exception['reportedByUserId'] ?? '');
            if (reporter) {
                ids.add(reporter);
            }
        }
        return [...ids];
    }

    participantName(userId: string): string {
        const user = this.usersById().get(userId);
        return String(
            user?.['name'] ??
                user?.['fullName'] ??
                user?.email ??
                this.agentNames().get(userId) ??
                userId
        );
    }

    participantEmail(userId: string): string {
        return this.usersById().get(userId)?.email ?? '';
    }

    participantPhone(userId: string): string {
        return this.usersById().get(userId)?.phone ?? '';
    }

    participantRole(row: AdminOrderGroupRow, userId: string): string {
        const assigned = String(
            row.agentId ?? row['assignedAgentUserId'] ?? ''
        );
        return assigned === userId
            ? this._t('admin.orderGroups.historyDetail.primaryAgent')
            : this._t('admin.orderGroups.historyDetail.exceptionReporter');
    }

    vehicleIds(row: AdminOrderGroupRow): string[] {
        const ids = new Set<string>();
        const raw = row as Record<string, unknown>;
        for (const candidate of [
            raw['vehicleId'],
            raw['assignedVehicleId'],
            (raw['vehicle'] as Record<string, unknown> | null)?.['id'],
            (raw['route'] as Record<string, unknown> | null)?.['vehicleId'],
        ]) {
            const id = String(candidate ?? '');
            if (id) {
                ids.add(id);
            }
        }
        if (Array.isArray(raw['vehicles'])) {
            for (const vehicle of raw['vehicles']) {
                const data = vehicle as Record<string, unknown>;
                const id = String(data['vehicleId'] ?? data['id'] ?? '');
                if (id) {
                    ids.add(id);
                }
            }
        }
        return [...ids];
    }

    allVehicleIds(row: AdminOrderGroupRow): string[] {
        return [
            ...new Set([...this.vehicleIds(row), ...this.sessionVehicleIds()]),
        ];
    }

    routeId(detail: SessionRouteDetail): string {
        return String(detail.route['routeId'] ?? detail.route.id ?? '');
    }

    routeStatus(detail: SessionRouteDetail): string {
        return this.statusLabel(String(detail.route['status'] ?? ''));
    }

    routeVehicleId(detail: SessionRouteDetail): string {
        return String(detail.route['vehicleId'] ?? '');
    }

    routeDriver(detail: SessionRouteDetail): string {
        const id = String(detail.route['driverUserId'] ?? '');
        return id ? this.participantName(id) : '—';
    }

    routeStops(detail: SessionRouteDetail): number {
        const stops = detail.route['stops'];
        if (!Array.isArray(stops)) {
            return detail.deliveries.length;
        }
        return stops.filter((stop) => {
            if (!stop || typeof stop !== 'object') return false;
            const entityType = String(
                (stop as Record<string, unknown>)['entityType'] ?? ''
            ).toLowerCase();
            return entityType !== 'hub';
        }).length;
    }

    vehicleLabel(vehicleId: string): string {
        const row = this.vehiclesById().get(vehicleId);
        return String(row?.['plateNumber'] ?? vehicleId);
    }

    vehicleType(vehicleId: string): string {
        return String(
            this.vehiclesById().get(vehicleId)?.['vehicleType'] ?? '—'
        );
    }

    vehicleCapacity(vehicleId: string): string {
        const capacity = this.vehiclesById().get(vehicleId)?.['capacityKg'];
        return capacity === null || capacity === undefined
            ? '—'
            : `${Number(capacity).toLocaleString(
                  this._transloco.getActiveLang()
              )} kg`;
    }

    restaurantOrderCount(restaurantId: string): number {
        return this.loadedOrders().filter(
            (order) => String(order.restaurantId ?? '') === restaurantId
        ).length;
    }

    restaurantOrderValue(restaurantId: string): number {
        return this.loadedOrders()
            .filter(
                (order) => String(order.restaurantId ?? '') === restaurantId
            )
            .reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0);
    }

    participatingRestaurants(): string[] {
        return [
            ...new Set(
                this.loadedOrders()
                    .map((order) => String(order.restaurantId ?? ''))
                    .filter(Boolean)
            ),
        ];
    }

    restaurantName(restaurantId: string): string {
        return this.restaurantNames().get(restaurantId) || restaurantId;
    }

    restaurantAddress(restaurantId: string): string {
        const order = this.loadedOrders().find(
            (item) => String(item.restaurantId ?? '') === restaurantId
        );
        return String(order?.deliveryAddress?.addressLine ?? '').trim();
    }

    restaurantPhone(restaurantId: string): string {
        const order = this.loadedOrders().find(
            (item) => String(item.restaurantId ?? '') === restaurantId
        );
        return String(order?.deliveryAddress?.phone ?? '').trim();
    }

    toggleOrder(orderId: string | null | undefined): void {
        if (!orderId) {
            return;
        }
        const open = new Set(this.expandedOrders());
        if (open.has(orderId)) {
            open.delete(orderId);
            this.expandedOrders.set(open);
            return;
        }
        open.add(orderId);
        this.expandedOrders.set(open);
        if (!this.orderDetails().has(orderId)) {
            this._loadOrder(orderId);
        }
    }

    statusLabel(status: string | null | undefined): string {
        if (!status) {
            return '—';
        }
        const key = statusLabelKey(status);
        if (!key) {
            return String(status);
        }
        return this._translateOrFallback(key, String(status));
    }

    paymentStatusLabel(status: string | null | undefined): string {
        if (!status) {
            return '—';
        }
        const token = String(status)
            .trim()
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[\s-]+/g, '_')
            .toLowerCase();
        return this._translateOrFallback(
            `admin.orderGroups.paymentStatus.${token}`,
            String(status)
        );
    }

    exceptionTypeLabel(type: string | null | undefined): string {
        if (!type) {
            return '—';
        }
        const knownByLower: Record<string, string> = {
            unavailable: 'Unavailable',
            shortfall: 'Shortfall',
            pricediscrepancy: 'PriceDiscrepancy',
            damaged: 'Damaged',
        };
        const known = knownByLower[String(type).trim().toLowerCase()];
        if (known) {
            return this._translateOrFallback(
                `admin.orderGroups.exceptionType.${known}`,
                known
            );
        }
        return String(type);
    }

    money(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const amount = Number(value);
        return Number.isNaN(amount)
            ? String(value)
            : `${amount.toLocaleString(this._transloco.getActiveLang())} ₫`;
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

    formatDateShort(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleDateString(this._transloco.getActiveLang());
    }

    private _fetch(id: string): void {
        this.loading.set(true);
        this._admin
            .getOrderGroup(id)
            .then((batch) => {
                this.batch.set(batch);
                this.notFound.set(!batch);
                this._prefetchMemberOrders(batch);
                this._loadSessionContext(batch);
            })
            .catch(() => this.notFound.set(true))
            .finally(() => this.loading.set(false));
    }

    private _loadLookups(): void {
        this._admin
            .getMarkets()
            .then((markets) =>
                this.marketNames.set(
                    new Map(
                        markets.map((m) => [String(m.id), String(m.name ?? '')])
                    )
                )
            )
            .catch(() => this.marketNames.set(new Map()));
        this._admin
            .getHubs()
            .then((hubs) =>
                this.hubNames.set(new Map(hubs.map((h) => [h.id, h.name])))
            )
            .catch(() => this.hubNames.set(new Map()));
        this._admin
            .getAgentOptions()
            .then((agents) => {
                this.agentNames.set(
                    new Map(
                        agents
                            .filter((a) => !!a.id)
                            .map((a) => [a.id, a.email || a.id])
                    )
                );
                this.usersById.set(
                    new Map(
                        agents
                            .filter((agent) => !!agent.id)
                            .map((agent) => [agent.id, agent])
                    )
                );
            })
            .catch(() => {
                this.agentNames.set(new Map());
                this.usersById.set(new Map());
            });
        this._admin
            .getUsers({ role: 'restaurant', pageSize: 100 })
            .then((result) => {
                const map = new Map<string, string>();
                for (const user of result.users) {
                    const restaurantId = String(user.restaurantId ?? '');
                    const name = String(user.restaurantName ?? '').trim();
                    if (restaurantId && name) {
                        map.set(restaurantId, name);
                    }
                }
                this.restaurantNames.set(map);
            })
            .catch(() => this.restaurantNames.set(new Map()));
        this._logistics
            .listVehicles()
            .then((vehicles) =>
                this.vehiclesById.set(
                    new Map(
                        vehicles
                            .filter((vehicle) => !!vehicle.id)
                            .map((vehicle) => [vehicle.id, vehicle])
                    )
                )
            )
            .catch(() => this.vehiclesById.set(new Map()));
    }

    /** Parallel GET /orders/{id} for every member so the Orders tab is ready. */
    private _prefetchMemberOrders(batch: AdminOrderGroupRow | null): void {
        this._loadProductUnits(batch);
        const ids = this.membersOf(batch)
            .map((m) => String(m.orderId ?? '').trim())
            .filter(Boolean);
        const missing = ids.filter((id) => !this.orderDetails().has(id));
        if (!missing.length) {
            return;
        }
        this.ordersPrefetching.set(true);
        void Promise.all(
            missing.map((orderId) =>
                this._admin
                    .getOrder(orderId)
                    .then((detail) => ({ orderId, detail }))
                    .catch(() => ({ orderId, detail: null }))
            )
        )
            .then((results) => {
                const cache = new Map(this.orderDetails());
                for (const { orderId, detail } of results) {
                    if (!detail) {
                        continue;
                    }
                    const normalizedId =
                        detail.orderId ||
                        (typeof detail['id'] === 'string'
                            ? detail['id']
                            : '') ||
                        orderId;
                    const existing = cache.get(orderId);
                    cache.set(orderId, {
                        ...existing,
                        ...detail,
                        restaurantName:
                            detail.restaurantName ?? existing?.restaurantName,
                        orderId: normalizedId,
                    });
                }
                this.orderDetails.set(cache);
            })
            .finally(() => this.ordersPrefetching.set(false));
    }

    private _loadSessionContext(batch: AdminOrderGroupRow | null): void {
        if (!batch) return;
        const sessionId = String(batch['marketSessionId'] ?? '').trim();
        const hubId = String(batch['hubId'] ?? '').trim();
        const serviceDate = String(
            batch['batchDate'] ?? batch.targetDate ?? ''
        ).slice(0, 10);
        const memberOrderIds = new Set(
            this.membersOf(batch)
                .map((member) => String(member.orderId ?? '').trim())
                .filter(Boolean)
        );

        this.sessionContextLoading.set(true);
        const tasks: Promise<unknown>[] = [];

        if (sessionId) {
            tasks.push(
                this._loadAllSessionOrders(sessionId).then((orders) => {
                    const cache = new Map(this.orderDetails());
                    for (const order of orders) {
                        if (!memberOrderIds.has(order.orderId)) continue;
                        const existing = cache.get(order.orderId);
                        cache.set(
                            order.orderId,
                            this._trackingOrderDetail(order, existing)
                        );
                        if (order.restaurantId && order.restaurantName) {
                            this.restaurantNames.update((names) => {
                                const next = new Map(names);
                                next.set(
                                    order.restaurantId,
                                    order.restaurantName
                                );
                                return next;
                            });
                        }
                    }
                    this.orderDetails.set(cache);
                })
            );
            tasks.push(
                this._admin
                    .getMarketSessionResources(sessionId)
                    .then((resources) => {
                        const selected = resources.vehicles.filter(
                            (vehicle) => vehicle.selected
                        );
                        this.sessionResourceVehicleIds.set(
                            selected.map((vehicle) => vehicle.vehicleId)
                        );
                        this.vehiclesById.update((rows) => {
                            const next = new Map(rows);
                            for (const vehicle of selected) {
                                next.set(vehicle.vehicleId, {
                                    id: vehicle.vehicleId,
                                    plateNumber: vehicle.plateNumber,
                                    vehicleType: vehicle.vehicleType,
                                    capacityKg: vehicle.capacityKg,
                                });
                            }
                            return next;
                        });
                    })
                    .catch(() => this.sessionResourceVehicleIds.set([]))
            );
        }

        if (serviceDate) {
            tasks.push(
                this._loadRelatedRoutes(serviceDate, hubId, memberOrderIds)
            );
        }
        if (hubId) {
            tasks.push(
                this._logistics
                    .getDiscrepancies(hubId)
                    .then((rows) =>
                        this.hubDiscrepancies.set(
                            rows.filter((row) =>
                                memberOrderIds.has(String(row['orderId'] ?? ''))
                            )
                        )
                    )
                    .catch(() => this.hubDiscrepancies.set([]))
            );
            tasks.push(
                this._logistics
                    .getEligibleDrivers(hubId)
                    .then((drivers) =>
                        this.usersById.update((users) => {
                            const next = new Map(users);
                            for (const driver of drivers) {
                                const id = String(
                                    driver['userId'] ??
                                        driver['driverUserId'] ??
                                        driver.id
                                );
                                if (!id) continue;
                                next.set(id, {
                                    id,
                                    fullName: String(driver['fullName'] ?? ''),
                                    email: String(driver['email'] ?? ''),
                                    phone: String(driver['phone'] ?? ''),
                                });
                            }
                            return next;
                        })
                    )
                    .catch(() => undefined)
            );
        }

        void Promise.allSettled(tasks).finally(() =>
            this.sessionContextLoading.set(false)
        );
    }

    private async _loadAllSessionOrders(
        sessionId: string
    ): Promise<AdminMarketSessionTrackingOrder[]> {
        const pageSize = 100;
        const first = await this._admin.getMarketSessionTracking(
            sessionId,
            1,
            pageSize
        );
        const orders = [...first.orders];
        const pageCount = Math.ceil(first.ordersPagination.total / pageSize);
        if (pageCount > 1) {
            const pages = await Promise.all(
                Array.from({ length: pageCount - 1 }, (_, index) =>
                    this._admin.getMarketSessionTracking(
                        sessionId,
                        index + 2,
                        pageSize
                    )
                )
            );
            orders.push(...pages.flatMap((page) => page.orders));
        }
        return [
            ...new Map(orders.map((order) => [order.orderId, order])).values(),
        ];
    }

    private _trackingOrderDetail(
        order: AdminMarketSessionTrackingOrder,
        existing?: AdminOrderDetail
    ): AdminOrderDetail {
        return {
            ...existing,
            orderId: order.orderId,
            restaurantId: order.restaurantId,
            restaurantName: order.restaurantName,
            status: order.status,
            subtotalAmount: order.subtotalAmount,
            vatAmount: order.vatAmount,
            deliveryFee: order.deliveryFee,
            totalAmount: order.totalAmount,
            confirmedAt: order.confirmedAt,
            items: order.items.map((item) => ({
                marketProductId: item.marketProductId,
                productNameSnapshot: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
            })),
        };
    }

    private async _loadRelatedRoutes(
        serviceDate: string,
        hubId: string,
        memberOrderIds: ReadonlySet<string>
    ): Promise<void> {
        const routes: CrudRow[] = [];
        let cursor: string | undefined;
        do {
            const page = await this._logistics.listRoutes({
                serviceDate,
                hubId: hubId || undefined,
                cursor,
            });
            routes.push(...page.rows);
            cursor = page.nextCursor;
        } while (cursor);

        const details = await Promise.all(
            routes.map(async (route): Promise<SessionRouteDetail | null> => {
                try {
                    const deliveries = await this._logistics.getRouteDeliveries(
                        String(route['routeId'] ?? route.id)
                    );
                    return deliveries.some((delivery) =>
                        memberOrderIds.has(delivery.orderId)
                    )
                        ? { route, deliveries }
                        : null;
                } catch {
                    return null;
                }
            })
        );
        this.sessionRoutes.set(
            details.filter((detail): detail is SessionRouteDetail => !!detail)
        );
    }

    private _loadProductUnits(batch: AdminOrderGroupRow | null): void {
        const marketId = String(batch?.marketId ?? '');
        if (!marketId || marketId === this._loadedUnitMarketId) {
            return;
        }
        this._loadedUnitMarketId = marketId;
        void this._catalog
            .listMarketProducts(marketId)
            .then((rows) => {
                const units = new Map<string, string>();
                for (const row of rows) {
                    const sellingUnit = (row['sellingUnit'] ?? null) as Record<
                        string,
                        unknown
                    > | null;
                    const id = String(row['marketProductId'] ?? row.id ?? '');
                    const unit = String(
                        row['unit'] ?? sellingUnit?.['unitName'] ?? ''
                    ).trim();
                    if (id && unit) {
                        units.set(id, unit);
                    }
                }
                this.productUnits.set(units);
            })
            .catch(() => this.productUnits.set(new Map()));
    }

    private _loadOrder(orderId: string): void {
        this._mutateSet(this.loadingOrders, orderId, true);
        this._admin
            .getOrder(orderId)
            .then((detail) => {
                if (detail) {
                    const cache = new Map(this.orderDetails());
                    const normalizedId =
                        detail.orderId ||
                        (typeof detail['id'] === 'string'
                            ? detail['id']
                            : '') ||
                        orderId;
                    cache.set(orderId, { ...detail, orderId: normalizedId });
                    this.orderDetails.set(cache);
                }
            })
            .catch(() => undefined)
            .finally(() => this._mutateSet(this.loadingOrders, orderId, false));
    }

    private _mutateSet(
        target: WritableSignal<Set<string>>,
        value: string,
        add: boolean
    ): void {
        const next = new Set(target());
        if (add) {
            next.add(value);
        } else {
            next.delete(value);
        }
        target.set(next);
    }

    private _t(key: string): string {
        return this._transloco.translate(key);
    }

    private _translateOrFallback(key: string, fallback: string): string {
        const label = this._transloco.translate(key);
        return label && label !== key ? label : fallback;
    }

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
