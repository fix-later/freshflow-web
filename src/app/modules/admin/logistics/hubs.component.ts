import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { createHubResource } from './hub-resource';
import { LogisticsAdminService } from './logistics-admin.service';

/**
 * Admin ▸ Logistics ▸ Hubs — hub master data (M8, admin = Full).
 *
 * Off the nav since hubs are managed per chợ; still routed, because the market
 * tab opens a hub's own page for its staff roster and oversight panel.
 */
@Component({
    selector: 'admin-hubs',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class HubsComponent {
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _router = inject(Router);

    readonly resource: CrudResource = createHubResource(
        this._logistics,
        this._router
    );
}
