import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { CatalogAdminService } from './catalog-admin.service';

/** Admin ▸ Catalog ▸ Units — units of measure master data (M3, admin = Full). */
@Component({
    selector: 'admin-units',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class UnitsComponent {
    private readonly _catalog = inject(CatalogAdminService);

    readonly resource: CrudResource = {
        title: 'admin.units.title',
        subtitle: 'admin.units.subtitle',
        createLabel: 'admin.units.create',
        inlineDetail: false,
        searchKeys: ['name', 'abbreviation'],
        searchPlaceholder: 'admin.units.searchPlaceholder',
        columns: [
            {
                label: 'admin.units.name',
                sortable: true,
                cell: (row) => String(row['name'] ?? ''),
            },
            {
                label: 'admin.units.abbreviation',
                sortable: true,
                cell: (row) => String(row['abbreviation'] ?? ''),
            },
        ],
        fields: [
            {
                // `CreateUnitCommandValidator`: `NotEmpty().MaximumLength(100)`
                // — 100, not the 200 the other catalog names use.
                name: 'name',
                label: 'admin.units.name',
                type: 'text',
                required: true,
                maxLength: 100,
            },
            {
                // `MaximumLength(20)` when present.
                name: 'abbreviation',
                label: 'admin.units.abbreviation',
                type: 'text',
                maxLength: 20,
            },
        ],
        list: () => this._catalog.listUnits(),
        create: (value) => this._catalog.createUnit(value),
        update: (id, value) => this._catalog.updateUnit(id, value),
        remove: (row) => this._catalog.deactivateUnit(row.id),
        removeLabel: 'admin.crud.deactivate',
        removeIsDeactivate: true,
        removeIcon: 'archive-box-x-mark',
    };
}
