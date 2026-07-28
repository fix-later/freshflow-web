import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { UnitsComponent } from './units.component';

/** Admin ▸ Catalog ▸ Units ▸ New — full-page create form. */
@Component({
    selector: 'admin-units-create',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
        pageMode="create"
    ></admin-resource-crud>`,
})
export class UnitsCreateComponent extends UnitsComponent {}
