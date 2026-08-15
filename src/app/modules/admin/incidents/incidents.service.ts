import { Injectable, inject } from '@angular/core';
import { AdminService } from '../admin.service';
import { AdminOrderGroupRow } from '../admin.types';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { CrudRow } from '../shared/resource-crud.types';
import { AdminIncident, IncidentStatus } from './incidents.types';

/** Phiên chợ scanned for exceptions — the same window the cost chart plots. */
const INCIDENT_BATCHES = 20;

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

/** Rows are untyped bodies; this narrows one field to an object array. */
function rowsOf(row: Record<string, unknown>, key: string): CrudRow[] {
    const value = row[key];
    return Array.isArray(value) ? (value as CrudRow[]) : [];
}

/**
 * `OPEN`/`ACKNOWLEDGED` as the backend spells it, lowercased. Anything else
 * (including a missing field) is left null rather than guessed as open — the
 * board treats "open" as actionable, and inventing one would put a row in the
 * queue that nobody can clear.
 */
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

/** A phiên chợ's display name, matching the order-groups table. */
function batchLabel(row: AdminOrderGroupRow): string | null {
    const parts = [
        stringOrNull(row.batchNumber),
        stringOrNull(row.marketName),
    ].filter((part): part is string => !!part);
    return parts.length ? parts.join(' · ') : stringOrNull(row.targetDate);
}

/**
 * The incident board's reads.
 *
 * Both sources are aggregations the backend does not offer as one call, and
 * they cost very differently:
 *
 *  - **Procurement exceptions** ride along on `GET /admin/order-groups`, which
 *    maps every batch through `ProcurementBatchDtoMapper` and therefore already
 *    carries each batch's `exceptions[]`. One request covers the whole window.
 *  - **Hub discrepancies** are per hub (`GET /hubs/{hubId}/discrepancies`), so
 *    this walks the hub list. There are a handful of hubs, and each read fails
 *    on its own — one unreachable hub costs its own rows, not the board.
 */
@Injectable({ providedIn: 'root' })
export class IncidentsService {
    private readonly _admin = inject(AdminService);
    private readonly _logistics = inject(LogisticsAdminService);

    /** Exceptions market agents reported across the recent phiên chợ. */
    async listProcurementIncidents(
        batches = INCIDENT_BATCHES
    ): Promise<AdminIncident[]> {
        const { groups } = await this._admin.getOrderGroups(1, batches);
        return groups.flatMap((group) => {
            const row = group as Record<string, unknown>;
            // The batch's own items name the products, so an exception's
            // `marketProductId` can be resolved without a catalog lookup.
            const productNames = new Map(
                rowsOf(row, 'items').map((item) => [
                    String(item['marketProductId'] ?? ''),
                    stringOrNull(item['productNameSnapshot']),
                ])
            );
            const place = batchLabel(group);
            const batchId = stringOrNull(group.id);

            return rowsOf(row, 'exceptions').map<AdminIncident>(
                (exception) => ({
                    id: String(exception['id'] ?? ''),
                    source: 'procurement',
                    type: String(exception['type'] ?? ''),
                    quantity: numberOrNull(exception['reportedQuantity']),
                    note: stringOrNull(exception['note']),
                    proofImageUrl: stringOrNull(exception['proofImageUrl']),
                    reportedAt: stringOrNull(exception['reportedAt']),
                    reportedBy: stringOrNull(exception['reportedByUserId']),
                    place,
                    subject:
                        productNames.get(
                            String(exception['marketProductId'] ?? '')
                        ) ?? null,
                    // An agent's report is a record, not a queue item.
                    status: null,
                    hubId: null,
                    link: batchId ? `/admin/order-groups/${batchId}` : null,
                })
            );
        });
    }

    /** Receiving discrepancies logged at every hub, open and signed off alike. */
    async listHubIncidents(): Promise<AdminIncident[]> {
        const hubs = await this._logistics.listHubs();
        const perHub = await Promise.all(
            hubs
                .filter((hub) => !!hub.id)
                .map((hub) =>
                    this._logistics
                        .getDiscrepancies(String(hub.id))
                        .then((rows) => this._toHubIncidents(hub, rows))
                        .catch(() => [] as AdminIncident[])
                )
        );
        return perHub.flat();
    }

    /**
     * Signs off a discrepancy. Until every one at a hub is acknowledged the hub
     * cannot dispatch, so this is the board's one write.
     */
    async acknowledge(hubId: string, incidentId: string): Promise<void> {
        await this._logistics.acknowledgeDiscrepancy(hubId, incidentId);
    }

    private _toHubIncidents(hub: CrudRow, rows: CrudRow[]): AdminIncident[] {
        const hubId = String(hub.id);
        const place = stringOrNull(hub['name']) ?? hubId;
        return rows.map((row) => {
            const orderId = stringOrNull(row['orderId']);
            return {
                id: String(row.id ?? row['discrepancyId'] ?? ''),
                source: 'hub' as const,
                type: String(row['conditionStatus'] ?? ''),
                quantity: numberOrNull(row['affectedQuantity']),
                note: stringOrNull(row['notes']),
                proofImageUrl: stringOrNull(row['proofImageUrl']),
                reportedAt: stringOrNull(row['createdAt']),
                // Hub staff log these on the shipment; the row records who
                // signed it off, not who raised it.
                reportedBy: null,
                place,
                // The order line, since neither endpoint resolves it further.
                subject: orderId ? orderId.slice(0, 8) : null,
                status: discrepancyStatusOf(row['status']),
                hubId,
                // The hub's own page, which carries the inbound shipment this
                // was logged against. There is no admin route for one order.
                link: `/admin/hubs/${hubId}`,
            };
        });
    }
}
