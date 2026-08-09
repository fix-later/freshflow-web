import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { MAX_TAG_NAME_LENGTH } from 'app/modules/catalog/catalog.types';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { CatalogAdminService, PIN_NO, PIN_YES } from './catalog-admin.service';

/**
 * Admin ▸ Catalog ▸ Tags — the global tag catalog (SCRUM-386, admin = Full).
 *
 * One shared vocabulary across every market: a market listing references these
 * by id, so a tag renamed here is renamed everywhere it is shown. `pinsToTop`
 * is what pins a listing to the top of a market's board — the platform no
 * longer has a magic "featured" tag name, so which tags pin is decided here and
 * nowhere else.
 */
@Component({
    selector: 'admin-tags',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class TagsComponent {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _transloco = inject(TranslocoService);

    readonly resource: CrudResource = {
        title: 'admin.tags.title',
        subtitle: 'admin.tags.subtitle',
        createLabel: 'admin.tags.create',
        inlineDetail: false,
        searchKeys: ['name'],
        searchPlaceholder: 'admin.tags.searchPlaceholder',
        columns: [
            {
                label: 'admin.tags.name',
                sortable: true,
                cell: (row) => String(row['name'] ?? ''),
            },
            {
                label: 'admin.tags.pinsToTop',
                sortable: true,
                width: '10rem',
                cell: (row) =>
                    this._transloco.translate(
                        row['pinsToTop'] === true
                            ? 'admin.tags.pin.yes'
                            : 'admin.tags.pin.no'
                    ),
            },
        ],
        fields: [
            {
                // `CreateTagCommandValidator`: `NotEmpty().MaximumLength(30)`.
                // Stored trimmed + lower-cased, and unique — a duplicate comes
                // back as 409 `TAG_NAME_CONFLICT`.
                name: 'name',
                label: 'admin.tags.name',
                type: 'text',
                required: true,
                maxLength: MAX_TAG_NAME_LENGTH,
            },
            {
                // A select rather than a checkbox: `CrudFormValue` carries only
                // strings and numbers, and the shell has no boolean control.
                name: 'pinsToTop',
                label: 'admin.tags.pinsToTop',
                type: 'select',
                required: true,
                // The shell renders option labels verbatim (no `t()`), so they
                // are translated here rather than passed as keys.
                options: () =>
                    Promise.resolve([
                        {
                            value: PIN_NO,
                            label: this._transloco.translate(
                                'admin.tags.pin.no'
                            ),
                        },
                        {
                            value: PIN_YES,
                            label: this._transloco.translate(
                                'admin.tags.pin.yes'
                            ),
                        },
                    ]),
            },
        ],
        list: () =>
            this._catalog
                .listTags()
                // The dialog seeds its controls from the row, so the boolean
                // has to already be in the select's vocabulary when it opens.
                .then((rows) =>
                    rows.map((row) => ({
                        ...row,
                        pinsToTop: row['pinsToTop'] === true ? PIN_YES : PIN_NO,
                    }))
                ),
        create: (value) => this._catalog.createTag(value),
        update: (id, value) => this._catalog.updateTag(id, value),
        // A hard delete, and it also strips the tag from every listing carrying
        // it — so no "reactivate" and no deactivate-style disabling.
        remove: (row) => this._catalog.deleteTag(row.id),
        removeLabel: 'admin.tags.delete',
    };
}
