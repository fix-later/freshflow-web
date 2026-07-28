import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { VehiclesComponent } from './vehicles.component';

/** Admin ▸ Logistics ▸ Vehicles ▸ New — full-page create form. */
@Component({
    selector: 'admin-vehicles-create',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
        pageMode="create"
    ></admin-resource-crud>`,
})
export class VehiclesCreateComponent extends VehiclesComponent {}
