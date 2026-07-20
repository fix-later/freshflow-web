import { Injectable } from '@angular/core';
import { extractList, parseJson } from 'app/core/api/envelope';
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
        const [res, managers] = await Promise.all([
            hubsApi.apiV1HubsGetRaw({ pageSize: 200 }),
            this.hubManagerOptions(),
        ]);
        const nameById = new Map(managers.map((m) => [m.value, m.label]));
        const rows = extractList<CrudRow>(await parseJson(res.raw));
        // Attach a resolved manager name so the table shows it instead of a UUID.
        return rows.map((row) => ({
            ...row,
            managedByName: row['managedBy']
                ? nameById.get(String(row['managedBy'])) ??
                  String(row['managedBy'])
                : '',
        }));
    }

    /** Hub-staff users as `{ value: id, label: email }` for the manager select. */
    async hubManagerOptions(): Promise<CrudOption[]> {
        try {
            const res = await adminApi.apiV1AdminUsersGetRaw({
                role: HUB_MANAGER_ROLE,
                pageSize: 100,
            });
            const users = extractList<{
                id?: string;
                email?: string;
                fullName?: string;
            }>(await parseJson(res.raw));
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
        const res = await vehiclesApi.apiV1LogisticsVehiclesGetRaw({
            pageSize: 200,
        });
        return extractList<CrudRow>(await parseJson(res.raw));
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
        return extractList<CrudRow>(await parseJson(res.raw));
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
