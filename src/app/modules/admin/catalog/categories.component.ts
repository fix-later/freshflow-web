import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import {
    CrudOption,
    CrudResource,
    CrudRow,
} from '../shared/resource-crud.types';
import { CatalogAdminService } from './catalog-admin.service';
import {
    CategoryMapComponent,
    CategoryMapData,
} from './category-map.component';

/**
 * Sentinel filter value for "categories with no parent". Filter values are
 * matched against `parentId`, and the absence of a parent has no id to match.
 */
const TOP_LEVEL = '__top_level__';

/**
 * Categories that are a parent of at least one row, as filter options.
 *
 * Derived from the rows already on screen: offering every category would list
 * leaves too, and picking one of those would always yield an empty table.
 */
function parentOptionsFrom(rows: CrudRow[]): CrudOption[] {
    const parentIds = new Set(
        rows
            .map((row) => (row['parentId'] ? String(row['parentId']) : ''))
            .filter(Boolean)
    );
    return rows
        .filter((row) => parentIds.has(row.id))
        .map((row) => ({ value: row.id, label: String(row['name'] ?? '') }));
}

/** Admin ▸ Catalog ▸ Categories — product category master data (M3, admin = Full). */
@Component({
    selector: 'admin-categories',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class CategoriesComponent {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _dialog = inject(MatDialog);

    readonly resource: CrudResource = {
        title: 'admin.categories.title',
        subtitle: 'admin.categories.subtitle',
        createLabel: 'admin.categories.create',
        searchKeys: ['name', 'parentName'],
        searchPlaceholder: 'admin.categories.searchPlaceholder',
        filters: [
            {
                name: 'parentId',
                label: 'admin.categories.filterByParent',
                // Built from the rows the table just fetched — no second GET.
                // A synthetic "top level" option covers the common case of
                // listing only roots, which no parent id can express.
                options: async (rows) => [
                    {
                        value: TOP_LEVEL,
                        label: this._transloco.translate(
                            'admin.categories.topLevelOnly'
                        ),
                    },
                    ...parentOptionsFrom(rows),
                ],
                match: (row, value) =>
                    value === TOP_LEVEL
                        ? !row['parentId']
                        : String(row['parentId'] ?? '') === value,
            },
        ],
        columns: [
            {
                label: 'admin.categories.name',
                sortable: true,
                cell: (row) => String(row['name'] ?? ''),
            },
            {
                label: 'admin.categories.parent',
                sortable: true,
                cell: (row) => String(row['parentName'] ?? ''),
            },
        ],
        fields: [
            {
                name: 'name',
                label: 'admin.categories.name',
                type: 'text',
                required: true,
            },
            {
                name: 'parentId',
                label: 'admin.categories.parent',
                type: 'select',
                searchable: true,
                options: () => this._catalog.categoryOptions(true),
            },
        ],
        headerActions: [
            {
                icon: 'share',
                label: 'admin.categories.map.open',
                // Uses the rows the page already loaded — no extra request.
                // Only active categories are mapped; `isActive === false` is
                // the same test the table's status pill uses, so a row missing
                // the field counts as active. A deactivated parent drops out
                // and its active children surface as roots (see buildForest).
                run: (rows, reload) => {
                    const ref = this._dialog.open(CategoryMapComponent, {
                        data: {
                            rows: rows.filter((row) => row.isActive !== false),
                        } satisfies CategoryMapData,
                        width: '72rem',
                        maxWidth: 'calc(100vw - 2rem)',
                        autoFocus: false,
                    });
                    // The map can re-parent categories itself; refresh the
                    // table when it reports it changed something.
                    ref.afterClosed().subscribe(
                        (changed) => changed && reload()
                    );
                },
            },
        ],
        list: () => this._catalog.listCategories(),
        create: (value) => this._catalog.createCategory(value),
        update: (id, value) => this._catalog.updateCategory(id, value),
        remove: (row) => this._catalog.deactivateCategory(row.id),
        activate: (row) => this._catalog.activateCategory(row),
        removeLabel: 'admin.crud.deactivate',
        removeIsDeactivate: true,
        removeIcon: 'archive-box-x-mark',
    };
}
