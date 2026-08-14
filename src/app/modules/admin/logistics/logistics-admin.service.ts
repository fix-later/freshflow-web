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
    hubHandoverApi,
    hubInboundApi,
    hubStaffAssignmentsApi,
    hubsApi,
    marketsApi,
    routesApi,
    shippingApi,
    vehiclesApi,
} from 'contract';
import {
    CrudFormValue,
    CrudOption,
    CrudRow,
} from '../shared/resource-crud.types';
import {
    CalculateRouteInput,
    DiscrepancyStatus,
    HubOption,
    LoadingManifest,
    LoadingManifestStop,
    OptimizationCriterion,
    PlanRoutesInput,
    RouteEligibility,
    RouteSuggestions,
} from './logistics-admin.types';
import { parseRouteSuggestions } from './route-suggestions';

/** Role whose users may manage a hub (see ROLE_MATRIX — Hub Staff). */
const HUB_MANAGER_ROLE = 'hub_staff';

/** Role whose users may be assigned to drive a route (see ROLE_MATRIX — M9). */
const DRIVER_ROLE = 'driver';

/** Role whose users own a restaurant — the delivery destinations of a route. */
const RESTAURANT_ROLE = 'restaurant';

function str(value: unknown): string {
    return value == null ? '' : String(value);
}

/** A real coordinate — present, numeric and finite. `0` is a valid one. */
function isCoordinate(value: unknown): boolean {
    if (value == null || value === '') {
        return false;
    }
    return Number.isFinite(Number(value));
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
 * Admin logistics data access (hubs, vehicles, routes), backed by the
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

    /**
     * Active hubs as `{ value: hubId, label: name }` — a route starts at
     * exactly one hub, so the route form picks from these.
     *
     * `marketId` narrows them to one chợ's hubs, which is what the market
     * page's vehicle picker offers: a vehicle is stationed at a hub, and only
     * this market's hubs belong on that form.
     */
    async hubOptions(marketId?: string): Promise<HubOption[]> {
        try {
            const rows = await fetchAllCursor<CrudRow>((cursor, pageSize) =>
                hubsApi
                    .apiV1HubsGetRaw({ cursor, pageSize, isActive: true })
                    .then((res) => res.raw)
            );
            return withId<CrudRow>(rows, 'hubId')
                .filter((row) => !!row.id)
                .filter(
                    (row) =>
                        !marketId || String(row['marketId'] ?? '') === marketId
                )
                .map((row) => ({
                    value: row.id,
                    label: str(row['name']) || row.id,
                    // `CalculateRouteCommandHandler` refuses a hub with no
                    // coordinates (`MISSING_COORDINATES`) — it is the route's
                    // first stop, so there is nothing to route from. Carried
                    // here so the picker can say so before the request.
                    hasCoordinates:
                        isCoordinate(row['latitude']) &&
                        isCoordinate(row['longitude']),
                }));
        } catch {
            return [];
        }
    }

    /** Hub-staff users as `{ value: id, label: email }` for the manager select. */
    async hubManagerOptions(): Promise<CrudOption[]> {
        return this._userOptions(HUB_MANAGER_ROLE);
    }

    /** Users holding `role`, as `{ value: id, label: email }` select options. */
    private async _userOptions(role: string): Promise<CrudOption[]> {
        try {
            const users = await fetchAllOffset<{
                id?: string;
                email?: string;
                fullName?: string;
            }>((page, pageSize) =>
                adminApi
                    .apiV1AdminUsersGetRaw({ role, page, pageSize })
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
     *
     * `status` must be one of {@link DISCREPANCY_STATUSES} — the backend
     * compares it against `HubDiscrepancy.StatusOpen`/`StatusAcknowledged`
     * verbatim, so it is SCREAMING_CASE and case-sensitive. (Earlier probes
     * used `open` / `Open` / `Acknowledged`, which is why every one of them
     * answered 400 and the panel used to count acknowledged rows too.)
     *
     * Rows carry `discrepancyId`, not `id`.
     */
    async getDiscrepancies(
        hubId: string,
        status?: DiscrepancyStatus
    ): Promise<CrudRow[]> {
        const res = await hubInboundApi.apiV1HubsHubIdDiscrepanciesGetRaw({
            hubId,
            status,
            pageSize: 50,
        });
        return withId<CrudRow>(
            extractList(await parseJson(res.raw)),
            'discrepancyId'
        );
    }

    /**
     * Closes out a discrepancy (`POST /hubs/{hubId}/discrepancies/{id}/acknowledge`).
     *
     * RBAC is `admin,operations_manager` — deliberately **not** `hub_staff`:
     * the staff who logged the shortage are not the ones who sign it off. Until
     * every discrepancy is acknowledged the hub cannot dispatch (BR-HUB-2), so
     * this is the console's unblock action, not a read-only view.
     *
     * Answers 409 `DISCREPANCY_ALREADY_ACKNOWLEDGED` if it was already signed
     * off, and 409 `OPTIMISTIC_CONCURRENCY_CONFLICT` if someone else got there
     * first; both are surfaced by the caller.
     */
    async acknowledgeDiscrepancy(
        hubId: string,
        discrepancyId: string
    ): Promise<CrudRow | null> {
        const res =
            await hubInboundApi.apiV1HubsHubIdDiscrepanciesDiscrepancyIdAcknowledgePostRaw(
                { hubId, discrepancyId }
            );
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        return withId([data as CrudRow], 'discrepancyId')[0] ?? null;
    }

    /**
     * The server's shipping estimate for one order — distance, duration and
     * fee as it would be charged. `vehicleId` narrows the estimate to a
     * specific vehicle when one is already assigned.
     *
     * Read-only: this is what dispatch quotes, not something the console sets.
     */
    async getShippingEstimate(
        orderId: string,
        vehicleId?: string
    ): Promise<Record<string, unknown> | null> {
        const res =
            await shippingApi.apiV1LogisticsShippingOrdersOrderIdEstimateGetRaw(
                { orderId, vehicleId: vehicleId || undefined }
            );
        return (
            unwrapData<Record<string, unknown>>(await parseJson(res.raw)) ??
            null
        );
    }

    /**
     * Goods already received at `hubId` on `date` (defaults to today).
     *
     * The pending list says what is still expected; this says what actually
     * arrived — PRD M8 gives Operations/Admin the inbound history even though
     * the receiving itself is a Hub Staff mobile action.
     */
    async getInboundHistory(hubId: string, date?: string): Promise<CrudRow[]> {
        const res = await hubInboundApi.apiV1HubsHubIdInboundGetRaw({
            hubId,
            date: date ? new Date(date) : undefined,
            pageSize: 50,
        });
        // Rows carry `inboundId`, not `id` — verified against the live API.
        return withId<CrudRow>(
            extractList(await parseJson(res.raw)),
            'inboundId'
        );
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

    /**
     * Driver handovers recorded at `hubId` — who took which route out, and
     * whether they have checked out yet (`CHECKED_OUT` vs `ARRIVED_AT_HUB`).
     *
     * Admin/ops get the full list regardless of hub-staff assignment (the
     * controller passes `BypassHubAssignment()` for both roles), so this is the
     * oversight view of the gate between the hub and the road.
     */
    async getHandovers(hubId: string): Promise<CrudRow[]> {
        const rows = await fetchAllCursor<CrudRow>((cursor, pageSize) =>
            hubHandoverApi
                .apiV1HubsHubIdHandoversGetRaw({ hubId, cursor, pageSize })
                .then((res) => res.raw)
        );
        return withId<CrudRow>(rows, 'handoverId');
    }

    /**
     * Drivers currently eligible to take a load out of `hubId`.
     *
     * `hubId` is RBAC scoping only: `ListEligibleDriversQueryHandler` reads
     * every active `driver` account and never looks at the hub, because no
     * driver↔hub relation exists — a driver only meets a hub through a
     * delivery route (`DeliveryRoute.HubId` + `DriverUserId`). Callers pass the
     * hub they are working from, so the result narrows on its own the day the
     * backend does filter.
     */
    async getEligibleDrivers(hubId: string): Promise<CrudRow[]> {
        const res = await hubHandoverApi.apiV1HubsHubIdDriversEligibleGetRaw({
            hubId,
        });
        return withId<CrudRow>(
            extractList(await parseJson(res.raw)),
            'driverUserId',
            'userId'
        );
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

    /**
     * What this hub needs to procure on `date`, aggregated from confirmed
     * orders. `date` is **required** by the API — omitting it answers 400
     * `'Date' must not be empty` — so it falls back to today rather than being
     * left off.
     */
    async getProcurementPlan(hubId: string, date?: string): Promise<CrudRow[]> {
        const res = await hubInboundApi.apiV1HubsHubIdProcurementPlanGetRaw({
            hubId,
            date: date ? new Date(date) : new Date(),
        });
        return withId<CrudRow>(extractList(await parseJson(res.raw)), 'id');
    }

    /**
     * Orders routed through `hubId`, grouped by restaurant, for
     * `serviceDate` — **required** by the API (400 `'Service Date' must not be
     * empty` without it), so it defaults to today.
     */
    async getOrdersByRestaurant(
        hubId: string,
        serviceDate?: string,
        includeBatched = false
    ): Promise<CrudRow[]> {
        const res = await hubInboundApi.apiV1HubsHubIdOrdersByRestaurantGetRaw({
            hubId,
            serviceDate: serviceDate ? new Date(serviceDate) : new Date(),
            includeBatched,
        });
        return withId<CrudRow>(extractList(await parseJson(res.raw)), 'id');
    }

    /**
     * Sorting progress at `hubId` for a service date (hub-staff's mobile sort
     * task). Sorting is tracked per hub-day now, not per route — the backend
     * moved it off `/hubs/{hubId}/routes/{routeId}/sorting-progress`.
     */
    async getSortingProgress(
        hubId: string,
        serviceDate?: string
    ): Promise<CrudRow | null> {
        const res = await hubInboundApi.apiV1HubsHubIdSortingProgressGetRaw({
            hubId,
            serviceDate: serviceDate ? new Date(serviceDate) : undefined,
        });
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        return withId([data as CrudRow], 'id')[0];
    }

    // ---- Routes (M9 Logistics, admin = Full) ------------------------------

    /**
     * One cursor page of delivery routes, optionally narrowed by service date
     * / status. Admin runs the whole VRP lifecycle here — calculate → select →
     * optimize → review → assign (RBAC `admin,operations_manager` on every
     * write, see `RoutesController`).
     */
    async listRoutes(query: {
        serviceDate?: string;
        status?: string;
        hubId?: string;
        cursor?: string;
    }): Promise<{ rows: CrudRow[]; nextCursor?: string }> {
        const res = await routesApi.apiV1LogisticsRoutesGetRaw({
            serviceDate: query.serviceDate
                ? new Date(query.serviceDate)
                : undefined,
            status: query.status || undefined,
            hubId: query.hubId || undefined,
            cursor: query.cursor,
            pageSize: 50,
        });
        const body = await parseJson(res.raw);
        return {
            rows: withId<CrudRow>(extractList(body), 'routeId'),
            nextCursor: extractNextCursor(body),
        };
    }

    /** Single route by id (detail page). */
    async getRoute(id: string): Promise<CrudRow | null> {
        const res = await routesApi.apiV1LogisticsRoutesIdGetRaw({ id });
        return this._routeOf(await parseJson(res.raw));
    }

    /**
     * Markets and restaurants worth routing on `serviceDate`, derived from the
     * orders sitting at a hub that day. Saves Admin from typing GUIDs into the
     * calculate form — and from silently forgetting a restaurant that has
     * goods waiting. `includeBatched` also counts orders still inbound.
     */
    async getRouteSuggestions(
        serviceDate: string,
        includeBatched = false
    ): Promise<RouteSuggestions> {
        const res = await routesApi.apiV1LogisticsRoutesSuggestionsGetRaw({
            serviceDate: new Date(serviceDate),
            includeBatched,
        });
        const data =
            unwrapData<Record<string, unknown>>(await parseJson(res.raw)) ?? {};
        return parseRouteSuggestions(data, serviceDate);
    }

    /**
     * Builds one route from a hub to the chosen restaurants (status `planned`).
     * Routes start at a hub — the backend no longer accepts market origins.
     */
    async calculateRoute(input: CalculateRouteInput): Promise<CrudRow | null> {
        const res = await routesApi.apiV1LogisticsRoutesCalculatePostRaw({
            calculateRouteRequest: {
                hubId: input.hubId,
                destinationRestaurantIds: input.destinationRestaurantIds,
                optimizationCriteria: input.optimizationCriteria.toUpperCase(),
                serviceDate: new Date(input.serviceDate),
            },
        });
        return this._routeOf(await parseJson(res.raw));
    }

    /**
     * Plans the whole day for a hub in one call — the backend groups that
     * day's restaurants into as many routes as it needs. Returns the created
     * routes so the list can refresh without a second round-trip.
     */
    async planRoutes(input: PlanRoutesInput): Promise<CrudRow[]> {
        const res = await routesApi.apiV1LogisticsRoutesPlanPostRaw({
            planRoutesRequest: {
                hubId: input.hubId,
                serviceDate: new Date(input.serviceDate),
                optimizationCriteria: input.optimizationCriteria.toUpperCase(),
            },
        });
        const body = await parseJson(res.raw);
        return withId<CrudRow>(extractList(body), 'routeId');
    }

    /** `planned` → `selected`: adopts the calculated model for optimization. */
    async selectRoute(id: string): Promise<CrudRow | null> {
        const res = await routesApi.apiV1LogisticsRoutesIdSelectPostRaw({ id });
        return this._routeOf(await parseJson(res.raw));
    }

    /** Re-orders the stops (nearest-neighbour + 2-opt) and recomputes metrics. */
    async optimizeRoute(
        id: string,
        criteria: OptimizationCriterion
    ): Promise<CrudRow | null> {
        const res = await routesApi.apiV1LogisticsRoutesIdOptimizePostRaw({
            id,
            optimizeRouteRequest: {
                optimizationCriteria: criteria.toUpperCase(),
            },
        });
        return this._routeOf(await parseJson(res.raw));
    }

    /**
     * `selected` → `reviewed`. Pass `stopOrder` (every stop's entity id, in the
     * wanted order) to override the optimizer's sequence — the backend then
     * recomputes the metrics for that manual order. Omit it to approve as-is.
     */
    async reviewRoute(
        id: string,
        stopOrder?: string[]
    ): Promise<CrudRow | null> {
        const res = await routesApi.apiV1LogisticsRoutesIdReviewPostRaw({
            id,
            reviewRouteRequest: { stopOrder: stopOrder ?? null },
        });
        return this._routeOf(await parseJson(res.raw));
    }

    /**
     * Vehicle + driver check for a route — capacity, availability, same-day
     * double-booking, driver role/status. Read-only: 200 even when ineligible,
     * with the blocking `reasons`.
     */
    async checkEligibility(
        routeId: string,
        vehicleId: string,
        driverUserId?: string
    ): Promise<RouteEligibility> {
        const res =
            await routesApi.apiV1LogisticsRoutesRouteIdEligibilityGetRaw({
                routeId,
                vehicleId,
                driverUserId: driverUserId || undefined,
            });
        const data =
            unwrapData<Record<string, unknown>>(await parseJson(res.raw)) ?? {};
        const reasons = Array.isArray(data['reasons'])
            ? (data['reasons'] as unknown[]).map((r) => str(r))
            : [];
        return {
            isEligible: data['isEligible'] === true,
            reasons,
            routeLoadKg: optNum(data['routeLoadKg']) ?? 0,
            vehicleCapacityKg: optNum(data['vehicleCapacityKg']) ?? 0,
            isWeightComplete: data['isWeightComplete'] !== false,
        };
    }

    /**
     * `reviewed` → `assigned`. The backend re-runs the eligibility check, and
     * now requires a driver alongside the vehicle.
     */
    async assignVehicle(
        id: string,
        vehicleId: string,
        driverUserId: string
    ): Promise<CrudRow | null> {
        const res = await routesApi.apiV1LogisticsRoutesIdAssignVehiclePostRaw({
            id,
            assignVehicleRequest: { vehicleId, driverUserId },
        });
        return this._routeOf(await parseJson(res.raw));
    }

    /**
     * What to load onto the truck, grouped by restaurant stop and already in
     * loading order (furthest first). Goods only — no prices.
     */
    async getLoadingManifest(id: string): Promise<LoadingManifest | null> {
        const res = await routesApi.apiV1LogisticsRoutesIdLoadingManifestGetRaw(
            { id }
        );
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        return {
            routeId: str(data['routeId']) || id,
            status: str(data['status']),
            serviceDate: str(data['serviceDate']),
            stops: this._manifestStops(data['stops']),
        };
    }

    /** Fleet as `{ value: id, label: "51C-12345 · VAN · 2,000 kg" }`. */
    async vehicleOptions(): Promise<CrudOption[]> {
        try {
            const rows = await this.listVehicles();
            return rows.map((row) => ({
                value: row.id,
                label: [
                    str(row['plateNumber']) || row.id,
                    str(row['vehicleType']),
                    row['capacityKg'] == null ? '' : `${row['capacityKg']} kg`,
                ]
                    .filter(Boolean)
                    .join(' · '),
            }));
        } catch {
            return [];
        }
    }

    /** Driver-role users as `{ value: id, label: email }` for the assign form. */
    async driverOptions(): Promise<CrudOption[]> {
        return this._userOptions(DRIVER_ROLE);
    }

    /**
     * Every restaurant as `{ value: restaurantId, label: name }` — the manual
     * fallback for the calculate form on a day the suggestions come back empty.
     */
    async restaurantOptions(): Promise<CrudOption[]> {
        try {
            const users = await fetchAllOffset<{
                restaurantId?: string | null;
                restaurantName?: string | null;
                email?: string;
            }>((page, pageSize) =>
                adminApi
                    .apiV1AdminUsersGetRaw({
                        role: RESTAURANT_ROLE,
                        page,
                        pageSize,
                    })
                    .then((res) => res.raw)
            );
            const byId = new Map<string, string>();
            for (const user of users) {
                if (user.restaurantId) {
                    byId.set(
                        user.restaurantId,
                        user.restaurantName || user.email || user.restaurantId
                    );
                }
            }
            return [...byId].map(([value, label]) => ({ value, label }));
        } catch {
            return [];
        }
    }

    /** Parses a single-route envelope into a table/detail row. */
    private _routeOf(body: unknown): CrudRow | null {
        const data = unwrapData<Record<string, unknown>>(body);
        if (!data) {
            return null;
        }
        const [row] = withId([data as CrudRow], 'routeId');
        return row?.id ? row : null;
    }

    private _manifestStops(value: unknown): LoadingManifestStop[] {
        if (!Array.isArray(value)) {
            return [];
        }
        return value
            .filter(
                (entry): entry is Record<string, unknown> =>
                    !!entry && typeof entry === 'object'
            )
            .map((entry) => ({
                stopOrder: optNum(entry['stopOrder']) ?? 0,
                restaurantId: str(entry['restaurantId']),
                restaurantName: str(entry['restaurantName']),
                lines: Array.isArray(entry['lines'])
                    ? (entry['lines'] as unknown[])
                          .filter(
                              (line): line is Record<string, unknown> =>
                                  !!line && typeof line === 'object'
                          )
                          .map((line) => ({
                              orderId: str(line['orderId']),
                              orderItemId: str(line['orderItemId']),
                              marketProductId: str(line['marketProductId']),
                              productName: str(line['productName']),
                              quantity: optNum(line['quantity']) ?? 0,
                              capacityKg: optNum(line['capacityKg']) ?? null,
                          }))
                    : [],
            }));
    }

    // ---- Vehicles ---------------------------------------------------------

    /** The fleet, or just the vehicles stationed at `hubId`. */
    async listVehicles(hubId?: string): Promise<CrudRow[]> {
        const rows = await fetchAllCursor<CrudRow>((cursor, pageSize) =>
            vehiclesApi
                .apiV1LogisticsVehiclesGetRaw({ cursor, pageSize, hubId })
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
                hubId: optStr(value['hubId']),
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
                hubId: optStr(value['hubId']),
            },
        });
    }

    /**
     * Stations a vehicle at a hub (`PUT /logistics/vehicles/{id}/hub`).
     *
     * Separate from {@link updateVehicle} on purpose: this writes only the hub,
     * so moving a vehicle needs neither the plate number nor the capacity nor
     * the type — which `UpdateVehicleCommand` requires and would re-validate
     * (`PLATE_NUMBER_DUPLICATE`, the `VehicleType` enum) on every move.
     *
     * There is no matching unassign: `AssignVehicleToHubCommandValidator`
     * demands a hub id, and `UpdateVehicleCommandHandler` applies `HubId` only
     * when it is non-null, so a vehicle cannot be taken off a hub through the
     * API at all.
     */
    async assignVehicleToHub(vehicleId: string, hubId: string): Promise<void> {
        await vehiclesApi.apiV1LogisticsVehiclesIdHubPut({
            id: vehicleId,
            assignVehicleToHubRequest: { hubId },
        });
    }

    async deleteVehicle(id: string): Promise<void> {
        await vehiclesApi.apiV1LogisticsVehiclesIdDelete({ id });
    }
}
