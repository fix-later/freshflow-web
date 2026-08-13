import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';
import { createVehicleResource } from './vehicle-resource';

/**
 * Admin ▸ Logistics ▸ Vehicles — fleet master data (M9, admin = Full).
 *
 * Off the nav — the fleet is managed from a chợ's vehicle tab — but still
 * routed, so existing links keep working.
 */
@Component({
    selector: 'admin-vehicles',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class VehiclesComponent {
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _transloco = inject(TranslocoService);

    readonly resource: CrudResource = createVehicleResource(
        this._logistics,
        (key) => this._transloco.translate(key)
    );
}
