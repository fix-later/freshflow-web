import { Injectable, inject } from '@angular/core';
import { mapWithLimit } from 'app/core/util/concurrency';
import { AdminService } from '../admin.service';
import {
    AdminOrderDetail,
    AdminOrderGroupRow,
    AdminUserRow,
} from '../admin.types';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { CrudRow } from '../shared/resource-crud.types';
import { AdminIncident, IncidentStatus } from './incidents.types';

const BATCH_PAGE_SIZE = 100;
const MAX_BATCH_PAGES = 100;
const READ_CONCURRENCY = 6;

function stringOrNull(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text === '' ? null : text;
}

function numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function rowsOf(row: Record<string, unknown>, key: string): CrudRow[] {
    const value = row[key];
    return Array.isArray(value) ? (value as CrudRow[]) : [];
}

function discrepancyStatusOf(value: unknown): IncidentStatus | null {
    switch (String(value ?? '').toUpperCase()) {
        case 'OPEN':
            return 'open';
        case 'ACKNOWLEDGED':
            return 'acknowledged';
        default:
            return null;
    }
}

function batchLabel(row: AdminOrderGroupRow): string | null {
    const parts = [
        stringOrNull(row.batchNumber),
        stringOrNull(row.marketName),
    ].filter((part): part is string => !!part);
    return parts.length ? parts.join(' · ') : stringOrNull(row.targetDate);
}

function userLabel(user: AdminUserRow | undefined): string | null {
    return user?.fullName || user?.email || null;
}

/**
 * Read model for Admin ▸ Báo cáo sự cố.
 *
 * Market-agent `/procurement/tasks` is role-scoped and rejects an admin JWT.
 * Admin therefore reads `/admin/order-groups`, which returns the same
 * `ProcurementBatchDto` (including `exceptions[]`). Hub discrepancies are read
 * from every hub's cursor-paged GET endpoint. No report data is fabricated.
 */
@Injectable({ providedIn: 'root' })
export class IncidentsService {
    private _usersPromise: Promise<AdminUserRow[]> | null = null;
    private readonly _orderCache = new Map<
        string,
        Promise<AdminOrderDetail | null>
    >();

    constructor(
        private readonly _admin: AdminService = inject(AdminService),
        private readonly _logistics: LogisticsAdminService = inject(
            LogisticsAdminService
        )
    ) {}

    /** Exceptions reported by market agents across every readable batch page. */
    async listProcurementIncidents(): Promise<AdminIncident[]> {
        const [groups, users] = await Promise.all([
            this._allOrderGroups(),
            this._users(),
        ]);
        const usersById = new Map(users.map((user) => [user.id, user]));

        return groups.flatMap((group) => {
            const row = group as Record<string, unknown>;
            const productNames = new Map(
                rowsOf(row, 'items').map((item) => [
                    String(item['marketProductId'] ?? ''),
                    stringOrNull(item['productNameSnapshot']),
                ])
            );
            const place = batchLabel(group);
            const batchId = stringOrNull(group.id);

            return rowsOf(row, 'exceptions').map<AdminIncident>((exception) => {
                const reporterId = stringOrNull(exception['reportedByUserId']);
                return {
                    id: String(exception['id'] ?? ''),
                    source: 'procurement',
                    type: String(exception['type'] ?? ''),
                    quantity: numberOrNull(exception['reportedQuantity']),
                    note: stringOrNull(exception['note']),
                    proofImageUrl: stringOrNull(exception['proofImageUrl']),
                    reportedAt: stringOrNull(exception['reportedAt']),
                    reportedBy: reporterId,
                    reporterName: reporterId
                        ? userLabel(usersById.get(reporterId))
                        : null,
                    place,
                    subject:
                        productNames.get(
                            String(exception['marketProductId'] ?? '')
                        ) ?? null,
                    context: stringOrNull(group.batchNumber),
                    status: null,
                    hubId: null,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    updatedAt: stringOrNull(exception['reportedAt']),
                    link: batchId ? `/admin/order-groups/${batchId}` : null,
                };
            });
        });
    }

    /** Receiving discrepancies from every hub and every cursor page. */
    async listHubIncidents(): Promise<AdminIncident[]> {
        const hubs = await this._logistics.listHubs();
        const perHub = await mapWithLimit(
            hubs.filter((hub) => !!hub.id),
            READ_CONCURRENCY,
            async (hub) => ({
                hub,
                rows: await this._logistics.getDiscrepancies(String(hub.id)),
            }),
            null
        );
        const base = perHub.flatMap((entry) =>
            entry ? this._toHubIncidents(entry.hub, entry.rows) : []
        );
        return this._enrichHubIncidents(base);
    }

    async acknowledge(hubId: string, incidentId: string): Promise<void> {
        await this._logistics.acknowledgeDiscrepancy(hubId, incidentId);
    }

    private async _allOrderGroups(): Promise<AdminOrderGroupRow[]> {
        const first = await this._admin.getOrderGroups(1, BATCH_PAGE_SIZE);
        const pageCount = Math.min(
            MAX_BATCH_PAGES,
            Math.ceil(first.totalCount / BATCH_PAGE_SIZE)
        );
        if (pageCount <= 1) {
            return first.groups;
        }
        const remaining = await mapWithLimit(
            Array.from({ length: pageCount - 1 }, (_, index) => index + 2),
            READ_CONCURRENCY,
            (page) =>
                this._admin
                    .getOrderGroups(page, BATCH_PAGE_SIZE)
                    .then((result) => result.groups),
            [] as AdminOrderGroupRow[]
        );
        return [first.groups, ...remaining].flat();
    }

    private _toHubIncidents(hub: CrudRow, rows: CrudRow[]): AdminIncident[] {
        const hubId = String(hub.id);
        const place = stringOrNull(hub['name']) ?? null;
        return rows.map((row) => ({
            id: String(row.id ?? row['discrepancyId'] ?? ''),
            source: 'hub' as const,
            type: String(row['conditionStatus'] ?? ''),
            quantity: numberOrNull(row['affectedQuantity']),
            note: stringOrNull(row['notes']),
            proofImageUrl: stringOrNull(row['proofImageUrl']),
            reportedAt: stringOrNull(row['createdAt']),
            reportedBy: null,
            reporterName: null,
            place,
            // Temporarily hold the two foreign keys; enrichment below replaces
            // both with names before rows reach the UI.
            subject: stringOrNull(row['orderItemId']),
            context: stringOrNull(row['orderId']),
            status: discrepancyStatusOf(row['status']),
            hubId,
            acknowledgedBy: stringOrNull(row['acknowledgedBy']),
            acknowledgedAt: stringOrNull(row['acknowledgedAt']),
            updatedAt: stringOrNull(row['updatedAt']),
            link: `/admin/hubs/${hubId}`,
        }));
    }

    private async _enrichHubIncidents(
        incidents: readonly AdminIncident[]
    ): Promise<AdminIncident[]> {
        const orderIds = [
            ...new Set(
                incidents
                    .map((incident) => incident.context)
                    .filter((id): id is string => !!id)
            ),
        ];
        const [orders, users] = await Promise.all([
            mapWithLimit(
                orderIds,
                READ_CONCURRENCY,
                (orderId) => this._order(orderId),
                null
            ),
            this._users(),
        ]);
        const orderById = new Map(
            orderIds.map((id, index) => [id, orders[index]])
        );
        const userById = new Map(users.map((user) => [user.id, user]));
        const restaurantById = new Map(
            users
                .filter((user) => !!user.restaurantId)
                .map((user) => [String(user.restaurantId), user])
        );

        return incidents.map((incident) => {
            const order = incident.context
                ? orderById.get(incident.context)
                : null;
            const item = order?.items?.find(
                (candidate) => candidate.orderItemId === incident.subject
            );
            const restaurant = order?.restaurantId
                ? restaurantById.get(String(order.restaurantId))
                : undefined;
            const orderContext = [
                order?.restaurantName ||
                    restaurant?.restaurantName ||
                    restaurant?.email,
                order?.status,
            ]
                .filter((value): value is string => !!value)
                .join(' · ');
            return {
                ...incident,
                subject: item?.productNameSnapshot || null,
                context: orderContext || null,
                acknowledgedBy: incident.acknowledgedBy
                    ? userLabel(userById.get(incident.acknowledgedBy))
                    : null,
            };
        });
    }

    private _users(): Promise<AdminUserRow[]> {
        this._usersPromise ??= this._admin.listUsers().catch(() => []);
        return this._usersPromise;
    }

    private _order(orderId: string): Promise<AdminOrderDetail | null> {
        let request = this._orderCache.get(orderId);
        if (!request) {
            request = this._admin.getOrder(orderId).catch(() => null);
            this._orderCache.set(orderId, request);
        }
        return request;
    }
}
