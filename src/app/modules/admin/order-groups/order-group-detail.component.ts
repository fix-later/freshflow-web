import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    WritableSignal,
    computed,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import {
    AdminBatchItem,
    AdminBatchMember,
    AdminOrderDetail,
    AdminOrderGroupRow,
    AdminOrderItem,
} from '../admin.types';
import { statusPillClass } from './order-group-status';

/** Row keys the client synthesizes (not from the API) — hidden from the grid. */
const DERIVED_ROW_KEYS = new Set([
    'id',
    'marketName',
    'agentId',
    'orderCount',
    'createdAt',
]);

/** Raw field key → i18n key for its detail-grid label (batch + order fields). */
const FIELD_LABEL_KEYS: Record<string, string> = {
    batchNumber: 'admin.orderGroups.field.batchNumber',
    batchDate: 'admin.orderGroups.field.batchDate',
    marketId: 'admin.orderGroups.field.market',
    hubId: 'admin.orderGroups.field.hub',
    status: 'admin.orderGroups.field.status',
    totalItemCount: 'admin.orderGroups.field.totalItemCount',
    manifestedAt: 'admin.orderGroups.field.manifestedAt',
    assignedAgentUserId: 'admin.orderGroups.field.agent',
    assignedAt: 'admin.orderGroups.field.assignedAt',
    handedOffAt: 'admin.orderGroups.field.handedOffAt',
    isCompleted: 'admin.orderGroups.field.isCompleted',
    cancelledAt: 'admin.orderGroups.field.cancelledAt',
    cancellationReason: 'admin.orderGroups.field.cancellationReason',
    orderId: 'admin.orderGroups.orderField.orderId',
    restaurantId: 'admin.orderGroups.orderField.restaurantId',
    paymentStatus: 'admin.orderGroups.orderField.paymentStatus',
    scheduledFor: 'admin.orderGroups.orderField.scheduledFor',
    totalAmount: 'admin.orderGroups.orderField.totalAmount',
    notes: 'admin.orderGroups.orderField.notes',
    orderGroupId: 'admin.orderGroups.orderField.orderGroupId',
    scheduledOrderId: 'admin.orderGroups.orderField.scheduledOrderId',
    confirmedReceiptAt: 'admin.orderGroups.orderField.confirmedReceiptAt',
    createdAt: 'admin.orderGroups.orderField.createdAt',
    updatedAt: 'admin.orderGroups.orderField.updatedAt',
};

/**
 * Admin ▸ Order groups ▸ Detail — a full-page overview of one procurement batch
 * (all raw fields, items, member orders with an order drill-down, and
 * exceptions), reached from the list so the list itself stays scannable.
 */
@Component({
    selector: 'admin-order-group-detail',
    templateUrl: './order-group-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        MatTooltipModule,
        TranslocoModule,
    ],
})
export class OrderGroupDetailComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly statusPillClass = statusPillClass;

    readonly batch = signal<AdminOrderGroupRow | null>(null);
    readonly loading = signal(false);
    readonly notFound = signal(false);

    /** id → name lookups so ids resolve to names in the field grid. */
    readonly marketNames = signal<Map<string, string>>(new Map());
    readonly hubNames = signal<Map<string, string>>(new Map());
    readonly agentNames = signal<Map<string, string>>(new Map());

    /** Member order drill-down: open ids, fetched-detail cache, in-flight ids. */
    readonly expandedOrders = signal<Set<string>>(new Set());
    readonly orderDetails = signal<Map<string, AdminOrderDetail>>(new Map());
    readonly loadingOrders = signal<Set<string>>(new Set());

    readonly batchId = computed(() => this.batch()?.id ?? '');

    ngOnInit(): void {
        this._loadLookups();
        const id = this._route.snapshot.paramMap.get('batchId') ?? '';
        // The list passes the row via router state for an instant render.
        const passed = (history.state?.batch ??
            null) as AdminOrderGroupRow | null;
        if (passed && passed.id === id) {
            this.batch.set(passed);
        } else if (id) {
            this._fetch(id);
        } else {
            this.notFound.set(true);
        }
    }

    goBack(): void {
        this._router.navigate(['/admin/order-groups']);
    }

    // ---- Field rendering --------------------------------------------------

    detailEntries(row: AdminOrderGroupRow): { label: string; value: string }[] {
        return this._rawScalars(row)
            .filter(([key]) => !DERIVED_ROW_KEYS.has(key))
            .map(([key, value]) => ({
                label: this.fieldLabel(key),
                value: this._fieldValue(row, key, value),
            }));
    }

    entriesOf(obj: unknown): { label: string; value: string }[] {
        return this._rawScalars(obj).map(([key, value]) => ({
            label: this.fieldLabel(key),
            value: this._displayValue(key, value),
        }));
    }

    fieldLabel(key: string): string {
        const translationKey = FIELD_LABEL_KEYS[key];
        if (translationKey) {
            const label = this._transloco.translate(translationKey);
            if (label && label !== translationKey) {
                return label;
            }
        }
        return this._humanize(key);
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

    // ---- Member order drill-down -----------------------------------------

    isOrderExpanded(orderId: string | null | undefined): boolean {
        return !!orderId && this.expandedOrders().has(orderId);
    }

    isOrderLoading(orderId: string | null | undefined): boolean {
        return !!orderId && this.loadingOrders().has(orderId);
    }

    orderDetail(orderId: string | null | undefined): AdminOrderDetail | null {
        return orderId ? this.orderDetails().get(orderId) ?? null : null;
    }

    orderItemsOf(detail: AdminOrderDetail | null): AdminOrderItem[] {
        const items = detail?.items;
        return Array.isArray(items) ? items : [];
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

    // ---- Presentation helpers --------------------------------------------

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

    // ---- Data -------------------------------------------------------------

    private _fetch(id: string): void {
        this.loading.set(true);
        this._admin
            .getOrderGroup(id)
            .then((batch) => {
                this.batch.set(batch);
                this.notFound.set(!batch);
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
            .then((agents) =>
                this.agentNames.set(
                    new Map(
                        agents
                            .filter((a) => !!a.id)
                            .map((a) => [a.id, a.email || a.id])
                    )
                )
            )
            .catch(() => this.agentNames.set(new Map()));
    }

    private _loadOrder(orderId: string): void {
        this._mutateSet(this.loadingOrders, orderId, true);
        this._admin
            .getOrder(orderId)
            .then((detail) => {
                if (detail) {
                    const cache = new Map(this.orderDetails());
                    cache.set(orderId, detail);
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

    private _fieldValue(
        row: AdminOrderGroupRow,
        key: string,
        value: unknown
    ): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const id = String(value);
        switch (key) {
            case 'marketId':
                return row.marketName || this.marketNames().get(id) || id;
            case 'hubId':
                return this.hubNames().get(id) || id;
            case 'assignedAgentUserId':
                return this.agentNames().get(id) || id;
            default:
                return this._displayValue(key, value);
        }
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
        if (typeof value === 'number' && /(amount|price|subtotal)/i.test(key)) {
            return this.money(value);
        }
        if (typeof value === 'string' && /(At|Date|For)$/.test(key)) {
            const formatted = this.formatDate(value);
            if (formatted) {
                return formatted;
            }
        }
        return String(value);
    }
}
