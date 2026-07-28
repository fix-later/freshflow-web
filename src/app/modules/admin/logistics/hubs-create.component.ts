import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { HubsComponent } from './hubs.component';

/** Admin ▸ Logistics ▸ Hubs ▸ New — full-page create form. */
@Component({
    selector: 'admin-hubs-create',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
        pageMode="create"
    ></admin-resource-crud>`,
})
export class HubsCreateComponent extends HubsComponent {}
