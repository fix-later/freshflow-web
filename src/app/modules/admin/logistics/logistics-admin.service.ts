import { Injectable } from '@angular/core';
import {
    extractList,
    extractNextCursor,
    fetchAllCursor,
    fetchAllOffset,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import {
    adminApi,
    deliveryZonesApi,
    hubInboundApi,
    hubStaffAssignmentsApi,
    hubsApi,
    marketsApi,
    routesApi,
    vehiclesApi,
} from 'contract';
import {
    CrudFormValue,
    CrudOption,
    CrudRow,
} from '../shared/resource-crud.types';

/** Role whose users may manage a hub (see ROLE_MATRIX — Hub Staff). */
const HUB_MANAGER_ROLE = 'hub_staff';

function str(value: unknown): string {
    return value == null ? '' : String(value);
}

function optStr(value: unknown): string | null {
    const trimmed = (value == null ? '' : String(value)).trim();
    return trimmed === '' ? null : trimmed;
}

function optNum(value: unknown): number | undefined {
    if (value == null || value === '') {
        return undefined;
    }
    const num = Number(value);
    return Number.isNaN(num) ? undefined : num;
}

/**
 * Admin logistics data access (hubs, vehicles, delivery zones), backed by the
 * generated OpenAPI client. List bodies are parsed via the shared envelope
 * helpers since the spec declares no response schemas.
 */
@Injectable({ providedIn: 'root' })
export class LogisticsAdminService {
    // ---- Hubs -------------------------------------------------------------

    async listHubs(): Promise<CrudRow[]> {
        const [rawRows, managers, markets] = await Promise.all([
            fetchAllCursor<CrudRow>((cursor, pageSize) =>
                hubsApi
                    .apiV1HubsGetRaw({ cursor, pageSize })
                    .then((res) => res.raw)
            ),
            this.hubManagerOptions(),
            this.marketOptions(),
        ]);
        const nameById = new Map(managers.map((m) => [m.value, m.label]));
        const marketNameById = new Map(markets.map((m) => [m.value, m.label]));
        // Hub routes name the key both ways (`/hubs/{id}` but
        // `/hubs/{hubId}/...`), so accept either as the row identifier.
        const rows = withId<CrudRow>(rawRows, 'hubId');
        return rows.map((row) => ({
            ...row,
            // Attach a resolved manager name so the table shows it, not a UUID.
            managedByName: row['managedBy']
                ? nameById.get(String(row['managedBy'])) ??
                  String(row['managedBy'])
                : '',
            marketName: row['marketId']
                ? marketNameById.get(String(row['marketId'])) ??
                  String(row['marketId'])
                : '',
        }));
    }

    /** Active markets as `{ value: id, label: name }` — a hub belongs to exactly one. */
    async marketOptions(): Promise<CrudOption[]> {
        try {
            const res = await marketsApi.apiV1MarketsGetRaw({
                activeOnly: true,
            });
            const rows = extractList<{ id?: string; name?: string }>(
                await parseJson(res.raw)
            );
            return rows
                .filter((m): m is { id: string; name?: string } => !!m.id)
                .map((m) => ({ value: m.id, label: m.name || m.id }));
        } catch {
            return [];
        }
    }

    /** Hub-staff users as `{ value: id, label: email }` for the manager select. */
    async hubManagerOptions(): Promise<CrudOption[]> {
        try {
            const users = await fetchAllOffset<{
                id?: string;
                email?: string;
                fullName?: string;
            }>((page, pageSize) =>
                adminApi
                    .apiV1AdminUsersGetRaw({
                        role: HUB_MANAGER_ROLE,
                        page,
                        pageSize,
                    })
                    .then((res) => res.raw)
            );
            return users
                .filter((u): u is { id: string; email?: string } => !!u.id)
                .map((u) => ({
                    value: u.id,
                    label: u.email || u.id,
                }));
        } catch {
            return [];
        }
    }

    /** Single hub by id (edit page). Resolves manager label like {@link listHubs}. */
    async getHub(id: string): Promise<CrudRow | null> {
        const [res, managers] = await Promise.all([
            hubsApi.apiV1HubsIdGetRaw({ id }),
            this.hubManagerOptions(),
        ]);
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        const [row] = withId([data as CrudRow], 'hubId');
        if (!row?.id) {
            return null;
        }
        const nameById = new Map(managers.map((m) => [m.value, m.label]));
        return {
            ...row,
            managedByName: row['managedBy']
                ? nameById.get(String(row['managedBy'])) ??
                  String(row['managedBy'])
                : '',
        };
    }

    async createHub(value: CrudFormValue): Promise<void> {
        await hubsApi.apiV1HubsPost({
            createHubRequest: {
                marketId: str(value['marketId']),
                name: str(value['name']),
                address: optStr(value['address']),
                latitude: optNum(value['latitude']) ?? null,
                longitude: optNum(value['longitude']) ?? null,
                capacityKg: optNum(value['capacityKg']),
                managedBy: optStr(value['managedBy']),
            },
        });
    }

    async updateHub(id: string, value: CrudFormValue): Promise<void> {
        await hubsApi.apiV1HubsIdPatch({
            id,
            updateHubRequest: {
                marketId: optStr(value['marketId']),
                name: str(value['name']),
                address: optStr(value['address']),
                latitude: optNum(value['latitude']) ?? null,
                longitude: optNum(value['longitude']) ?? null,
                capacityKg: optNum(value['capacityKg']),
                managedBy: optStr(value['managedBy']),
            },
        });
    }

    async deleteHub(id: string): Promise<void> {
        await hubsApi.apiV1HubsIdDelete({ id });
    }

    // ---- Hub staff assignments (M8 Hub management, admin = Full) ----------

    /** Hub-staff ids currently assigned to work at `hubId`. */
    async getHubStaffAssignments(hubId: string): Promise<string[]> {
        const res =
            await hubStaffAssignmentsApi.apiV1HubsHubIdStaffAssignmentsGetRaw({
                hubId,
            });
        const data = unwrapData<unknown>(await parseJson(res.raw));
        return this._assignmentUserIds(data);
    }

    /** Replaces the full staff roster for `hubId` (mirrors market assignments). */
    async replaceHubStaffAssignments(
        hubId: string,
        staffUserIds: string[]
    ): Promise<void> {
        await hubStaffAssignmentsApi.apiV1HubsHubIdStaffAssignmentsPutRaw({
            hubId,
            replaceHubStaffAssignmentsRequest: { staffUserIds },
        });
    }

    /**
     * Pulls assigned user ids out of the (untyped) staff-assignments body,
     * tolerating a bare array or an object wrapper (`staffUserIds` / `items` /
     * …), and entries that are either plain id strings or objects.
     */
    private _assignmentUserIds(data: unknown): string[] {
        let list: unknown[] = [];
        if (Array.isArray(data)) {
            list = data;
        } else if (data && typeof data === 'object') {
            const record = data as Record<string, unknown>;
            for (const key of [
                'staffUserIds',
                'userIds',
                'assignments',
                'items',
                'results',
                'value',
                'data',
            ]) {
                if (Array.isArray(record[key])) {
                    list = record[key] as unknown[];
                    break;
                }
            }
        }
        return list
            .map((entry) => {
                if (typeof entry === 'string') {
                    return entry;
                }
                if (entry && typeof entry === 'object') {
                    const e = entry as Record<string, unknown>;
                    const value = e['userId'] ?? e['staffUserId'] ?? e['id'];
                    return typeof value === 'string' ? value : null;
                }
                return null;
            })
            .filter((id): id is string => !!id);
    }

    // ---- Hub inbound/discrepancy oversight (M8 Hub, admin = read-only) ----

    /**
     * Pending inbound shipments for `hubId` (goods expected but not yet
     * checked in). Read-only oversight — recording the actual inbound is Hub
     * Staff's mobile workflow.
     */
    async getPendingInbound(hubId: string): Promise<CrudRow[]> {
        const res = await hubInboundApi.apiV1HubsHubIdPendingInboundGetRaw({
            hubId,
            pageSize: 50,
        });
        return withId<CrudRow>(extractList(await parseJson(res.raw)), 'id');
    }

    /**
     * Discrepancies logged at `hubId`, optionally narrowed by status. An open
     * discrepancy blocks dispatch (BR-HUB-2) — surfaced so Admin can see what's
     * currently stuck without needing hub-staff mobile access.
     */
    async getDiscrepancies(hubId: string, status?: string): Promise<CrudRow[]> {
        const res = await hubInboundApi.apiV1HubsHubIdDiscrepanciesGetRaw({
            hubId,
            status,
            pageSize: 50,
        });
        return withId<CrudRow>(extractList(await parseJson(res.raw)), 'id');
    }

    /** In-flight cross-dock transfers at `hubId`, optionally narrowed by status. */
    async getCrossDock(hubId: string, status?: string): Promise<CrudRow[]> {
        const res = await hubInboundApi.apiV1HubsHubIdCrossDockGetRaw({
            hubId,
            status,
            pageSize: 50,
        });
        return withId<CrudRow>(extractList(await parseJson(res.raw)), 'id');
    }

    /** Outbound shipments dispatched from `hubId` on `date` (defaults to today). */
    async getOutbound(hubId: string, date?: string): Promise<CrudRow[]> {
        const res = await hubInboundApi.apiV1HubsHubIdOutboundGetRaw({
            hubId,
            date: date ? new Date(date) : undefined,
            pageSize: 50,
        });
        return withId<CrudRow>(extractList(await parseJson(res.raw)), 'id');
    }

    /** What this hub needs to procure for `date` (defaults to today), aggregated from confirmed orders. */
    async getProcurementPlan(hubId: string, date?: string): Promise<CrudRow[]> {
        const res = await hubInboundApi.apiV1HubsHubIdProcurementPlanGetRaw({
            hubId,
            date: date ? new Date(date) : undefined,
        });
        return withId<CrudRow>(extractList(await parseJson(res.raw)), 'id');
    }

    /** Orders routed through `hubId`, grouped by restaurant, for `serviceDate`. */
    async getOrdersByRestaurant(
        hubId: string,
        serviceDate?: string,
        includeBatched = false
    ): Promise<CrudRow[]> {
        const res = await hubInboundApi.apiV1HubsHubIdOrdersByRestaurantGetRaw({
            hubId,
            serviceDate: serviceDate ? new Date(serviceDate) : undefined,
            includeBatched,
        });
        return withId<CrudRow>(extractList(await parseJson(res.raw)), 'id');
    }

    /** Sorting progress for `routeId`'s shipments at `hubId` (hub-staff's mobile sort task). */
    async getSortingProgress(
        hubId: string,
        routeId: string
    ): Promise<CrudRow | null> {
        const res =
            await hubInboundApi.apiV1HubsHubIdRoutesRouteIdSortingProgressGetRaw(
                { hubId, routeId }
            );
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        return withId([data as CrudRow], 'id')[0];
    }

    // ---- Routes (M9 Logistics, admin = read-only oversight) ---------------

    /**
     * One cursor page of delivery routes, optionally narrowed by service date
     * / status. Admin only has read access here (VRP calculate/optimize/assign
     * is Operations Manager's workflow, per ROLE_MATRIX M9) — this is an
     * oversight view, not a dispatch console.
     */
    async listRoutes(query: {
        serviceDate?: string;
        status?: string;
        cursor?: string;
    }): Promise<{ rows: CrudRow[]; nextCursor?: string }> {
        const res = await routesApi.apiV1LogisticsRoutesGetRaw({
            serviceDate: query.serviceDate
                ? new Date(query.serviceDate)
                : undefined,
            status: query.status || undefined,
            cursor: query.cursor,
            pageSize: 50,
        });
        const body = await parseJson(res.raw);
        return {
            rows: withId<CrudRow>(extractList(body), 'routeId'),
            nextCursor: extractNextCursor(body),
        };
    }

    /** Single route by id (detail page) — raw fields, rendered generically. */
    async getRoute(id: string): Promise<CrudRow | null> {
        const res = await routesApi.apiV1LogisticsRoutesIdGetRaw({ id });
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        const [row] = withId([data as CrudRow], 'routeId');
        return row?.id ? row : null;
    }

    // ---- Vehicles ---------------------------------------------------------

    async listVehicles(): Promise<CrudRow[]> {
        const rows = await fetchAllCursor<CrudRow>((cursor, pageSize) =>
            vehiclesApi
                .apiV1LogisticsVehiclesGetRaw({ cursor, pageSize })
                .then((res) => res.raw)
        );
        return withId<CrudRow>(rows, 'vehicleId');
    }

    async createVehicle(value: CrudFormValue): Promise<void> {
        await vehiclesApi.apiV1LogisticsVehiclesPost({
            registerVehicleRequest: {
                plateNumber: str(value['plateNumber']),
                vehicleType: optStr(value['vehicleType']),
                capacityKg: optNum(value['capacityKg']),
            },
        });
    }

    async updateVehicle(id: string, value: CrudFormValue): Promise<void> {
        await vehiclesApi.apiV1LogisticsVehiclesIdPut({
            id,
            updateVehicleRequest: {
                plateNumber: str(value['plateNumber']),
                vehicleType: optStr(value['vehicleType']),
                capacityKg: optNum(value['capacityKg']),
            },
        });
    }

    async deleteVehicle(id: string): Promise<void> {
        await vehiclesApi.apiV1LogisticsVehiclesIdDelete({ id });
    }

    // ---- Delivery zones ---------------------------------------------------

    /**
     * All zones in one request (BE has no offset pagination). The admin
     * table paginates client-side from this list.
     */
    async listZones(): Promise<CrudRow[]> {
        const res = await deliveryZonesApi.apiV1LogisticsDeliveryZonesGetRaw({
            activeOnly: false,
        });
        const body = await parseJson(res.raw);
        return withId<CrudRow>(extractList(body), 'zoneId', 'deliveryZoneId');
    }

    async createZone(value: CrudFormValue): Promise<void> {
        await deliveryZonesApi.apiV1LogisticsDeliveryZonesPost({
            createDeliveryZoneRequest: {
                code: str(value['code']),
                name: str(value['name']),
                description: optStr(value['description']),
            },
        });
    }

    async updateZone(id: string, value: CrudFormValue): Promise<void> {
        await deliveryZonesApi.apiV1LogisticsDeliveryZonesIdPut({
            id,
            updateDeliveryZoneRequest: {
                name: str(value['name']),
                description: optStr(value['description']),
            },
        });
    }

    async deleteZone(id: string): Promise<void> {
        await deliveryZonesApi.apiV1LogisticsDeliveryZonesIdDelete({ id });
    }
}
