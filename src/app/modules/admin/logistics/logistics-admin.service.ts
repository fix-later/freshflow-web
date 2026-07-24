import { Injectable } from '@angular/core';
import {
    extractList,
    extractPagination,
    extractTotal,
    fetchAllCursor,
    fetchAllOffset,
    parseJson,
    withId,
} from 'app/core/api/envelope';
import { adminApi, deliveryZonesApi, hubsApi, vehiclesApi } from 'contract';
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

    /** All zones (pages to completion) for pickers. */
    async listZones(): Promise<CrudRow[]> {
        const rawRows = await fetchAllOffset<CrudRow>((page, pageSize) =>
            deliveryZonesApi
                .apiV1LogisticsDeliveryZonesGetRaw({
                    activeOnly: false,
                    page,
                    pageSize,
                })
                .then((res) => res.raw)
        );
        return withId<CrudRow>(rawRows, 'zoneId', 'deliveryZoneId');
    }

    /** One offset page of delivery zones for the admin table. */
    async listZonesPage(query: {
        page: number;
        pageSize: number;
        activeOnly?: boolean;
    }): Promise<{
        rows: CrudRow[];
        total: number;
        page?: number;
        pageSize?: number;
    }> {
        const res = await deliveryZonesApi.apiV1LogisticsDeliveryZonesGetRaw({
            activeOnly: query.activeOnly ?? false,
            page: query.page,
            pageSize: query.pageSize,
        });
        const body = await parseJson(res.raw);
        const rows = withId<CrudRow>(
            extractList(body),
            'zoneId',
            'deliveryZoneId'
        );
        const info = extractPagination(body);
        return {
            rows,
            total: info?.total ?? extractTotal(body) ?? rows.length,
            page: info?.page,
            pageSize: info?.pageSize,
        };
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
