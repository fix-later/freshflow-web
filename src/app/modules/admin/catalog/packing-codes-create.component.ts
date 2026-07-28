import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { PackingCodesComponent } from './packing-codes.component';

/** Admin ▸ Catalog ▸ Packing codes ▸ New — full-page create form. */
@Component({
    selector: 'admin-packing-codes-create',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
        pageMode="create"
    ></admin-resource-crud>`,
})
export class PackingCodesCreateComponent extends PackingCodesComponent {}
