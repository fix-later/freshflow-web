import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { DeliveryZonesComponent } from './delivery-zones.component';

/** Admin ▸ Logistics ▸ Delivery zones ▸ New — full-page create form. */
@Component({
    selector: 'admin-delivery-zones-create',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
        pageMode="create"
    ></admin-resource-crud>`,
})
export class DeliveryZonesCreateComponent extends DeliveryZonesComponent {}
