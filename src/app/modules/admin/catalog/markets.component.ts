import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { CatalogAdminService } from './catalog-admin.service';

/** Admin ▸ Catalog ▸ Markets — market master data + drill-in to pricing (M3, admin = Full). */
@Component({
    selector: 'admin-markets',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class MarketsComponent {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _router = inject(Router);

    readonly resource: CrudResource = {
        title: 'admin.markets.title',
        subtitle: 'admin.markets.subtitle',
        createLabel: 'admin.markets.create',
        searchKeys: ['name', 'location', 'address'],
        searchPlaceholder: 'admin.markets.searchPlaceholder',
        columns: [
            {
                label: 'admin.markets.name',
                sortable: true,
                cell: (row) => String(row['name'] ?? ''),
            },
            {
                label: 'admin.markets.location',
                sortable: true,
                cell: (row) => String(row['location'] ?? ''),
            },
            {
                label: 'admin.markets.address',
                sortable: true,
                cell: (row) => String(row['address'] ?? ''),
            },
        ],
        fields: [
            {
                name: 'name',
                label: 'admin.markets.name',
                type: 'text',
                required: true,
            },
            {
                name: 'location',
                label: 'admin.markets.location',
                type: 'text',
            },
            {
                name: 'address',
                label: 'admin.markets.address',
                type: 'text',
            },
            {
                name: 'latitude',
                label: 'admin.markets.latitude',
                type: 'number',
            },
            {
                name: 'longitude',
                label: 'admin.markets.longitude',
                type: 'number',
            },
        ],
        rowActions: [
            {
                icon: 'currency-dollar',
                tooltip: 'admin.markets.pricing',
                run: (row) =>
                    void this._router.navigate([
                        '/admin/markets',
                        row.id,
                        'products',
                    ]),
            },
        ],
        list: () => this._catalog.listMarkets(),
        create: (value) => this._catalog.createMarket(value),
        update: (id, value) => this._catalog.updateMarket(id, value),
        remove: (row) => this._catalog.deactivateMarket(row.id),
        removeLabel: 'admin.crud.deactivate',
        removeIsDeactivate: true,
        removeIcon: 'archive-box-x-mark',
    };
}
