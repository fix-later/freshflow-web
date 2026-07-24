import { Injectable } from '@angular/core';
import {
    extractList,
    fetchAllCursor,
    fetchAllOffset,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import {
    adminApi,
    deliveryZonesApi,
    hubsApi,
    hubStaffAssignmentsApi,
    vehiclesApi,
} from 'contract';
import {
    CrudFormValue,
    CrudOption,
    CrudRow,
} from '../shared/resource-crud.types';

/** Role whose users may manage a hub (see ROLE_MATRIX — Hub Staff). */
const HUB_MANAGER_ROLE = 'hub_staff';

/** A hub staff assignment — bare user id or an object wrapping one. */
type HubStaffAssignmentEntry =
    | string
    | { userId?: string; staffUserId?: string; id?: string };

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
        const [rawRows, managers] = await Promise.all([
            fetchAllCursor<CrudRow>((cursor, pageSize) =>
                hubsApi
                    .apiV1HubsGetRaw({ cursor, pageSize })
                    .then((res) => res.raw)
            ),
            this.hubManagerOptions(),
        ]);
        const nameById = new Map(managers.map((m) => [m.value, m.label]));
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
        }));
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

    async createHub(value: CrudFormValue): Promise<void> {
        await hubsApi.apiV1HubsPost({
            createHubRequest: {
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

    /**
     * A hub's display name, for screens reached by deep link.
     *
     * The staff page normally gets the name from the row the list passed via
     * router state, but that is gone after a reload — falling back to this
     * keeps the heading from showing a bare UUID.
     */
    async getHubName(id: string): Promise<string> {
        const res = await hubsApi.apiV1HubsIdGetRaw({ id });
        const hub = unwrapData<{ name?: string }>(await parseJson(res.raw));
        return str(hub?.name);
    }

    // ---- Hub staff assignments -------------------------------------------

    /**
     * Ids of the hub-staff users rostered to a hub. The list body is untyped,
     * so accept both a bare id array and `{ userId | id }` objects.
     */
    async listHubStaffAssignments(hubId: string): Promise<string[]> {
        const res =
            await hubStaffAssignmentsApi.apiV1HubsHubIdStaffAssignmentsGetRaw({
                hubId,
            });
        const entries = extractList<HubStaffAssignmentEntry>(
            await parseJson(res.raw)
        );
        return entries
            .map((entry) =>
                typeof entry === 'string'
                    ? entry
                    : entry.userId ?? entry.staffUserId ?? entry.id
            )
            .filter((id): id is string => !!id);
    }

    async replaceHubStaffAssignments(
        hubId: string,
        staffUserIds: string[]
    ): Promise<void> {
        await hubStaffAssignmentsApi.apiV1HubsHubIdStaffAssignmentsPut({
            hubId,
            replaceHubStaffAssignmentsRequest: { staffUserIds },
        });
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

    async listZones(): Promise<CrudRow[]> {
        const res = await deliveryZonesApi.apiV1LogisticsDeliveryZonesGetRaw({
            activeOnly: false,
        });
        return withId<CrudRow>(
            extractList(await parseJson(res.raw)),
            'zoneId',
            'deliveryZoneId'
        );
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
