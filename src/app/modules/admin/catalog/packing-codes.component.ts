import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { CatalogAdminService } from './catalog-admin.service';

/**
 * Smallest capacity the server accepts — `GreaterThan(0)`. Expressed as a
 * positive step rather than `0` because `Validators.min(0)` would still admit
 * the zero the backend refuses.
 */
const PACKING_CAPACITY_MIN = 0.1;

/**
 * `Logistics:Box:MaxLoadKg` — 25 in `appsettings.json`, and the validator's
 * fallback when the key is absent. A box heavier than one person can carry is
 * not a packing code, so the ceiling is the same on both sides; if the config
 * is ever raised, this is the constant to follow it.
 */
const PACKING_CAPACITY_MAX_KG = 25;

/**
 * Admin ▸ Catalog ▸ Packing codes — box/crate size codes used to pack
 * procurement items for hand-off (M3, admin = Full).
 */
@Component({
    selector: 'admin-packing-codes',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class PackingCodesComponent {
    private readonly _catalog = inject(CatalogAdminService);

    readonly resource: CrudResource = {
        title: 'admin.packingCodes.title',
        subtitle: 'admin.packingCodes.subtitle',
        createLabel: 'admin.packingCodes.create',
        inlineDetail: false,
        searchKeys: ['code', 'description'],
        searchPlaceholder: 'admin.packingCodes.searchPlaceholder',
        columns: [
            {
                label: 'admin.packingCodes.code',
                sortable: true,
                cell: (row) => String(row['code'] ?? ''),
            },
            {
                label: 'admin.packingCodes.description',
                sortable: true,
                cell: (row) => String(row['description'] ?? ''),
            },
            {
                label: 'admin.packingCodes.capacityKg',
                sortable: true,
                sortValue: (row) => Number(row['capacityKg'] ?? 0),
                cell: (row) =>
                    row['capacityKg'] != null ? `${row['capacityKg']} kg` : '',
            },
        ],
        fields: [
            {
                name: 'code',
                label: 'admin.packingCodes.code',
                type: 'text',
                required: true,
                maxLength: 50,
            },
            {
                /**
                 * `CreatePackingCodeRequest.CapacityKg` is a non-nullable
                 * `decimal` with `GreaterThan(0).LessThanOrEqualTo(maxLoadKg)`.
                 * Left optional here, a blank was sent as `undefined`, bound
                 * server-side to `0`, and rejected — so every create without a
                 * capacity failed while the form said the field was optional.
                 */
                name: 'capacityKg',
                label: 'admin.packingCodes.capacityKg',
                type: 'number',
                required: true,
                min: PACKING_CAPACITY_MIN,
                max: PACKING_CAPACITY_MAX_KG,
            },
            {
                name: 'description',
                label: 'admin.packingCodes.description',
                type: 'textarea',
                // `MaximumLength(500)` on both the create and update validator.
                maxLength: 500,
            },
        ],
        list: () => this._catalog.listPackingCodes(),
        create: (value) => this._catalog.createPackingCode(value),
        update: (id, value) => this._catalog.updatePackingCode(id, value),
        remove: (row) => this._catalog.deactivatePackingCode(row.id),
        removeLabel: 'admin.crud.deactivate',
        removeIsDeactivate: true,
        removeIcon: 'archive-box-x-mark',
    };
}
