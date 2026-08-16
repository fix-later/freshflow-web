import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { createHubResource } from './hub-resource';
import { LogisticsAdminService } from './logistics-admin.service';

/**
 * Admin ▸ Quản trị ▸ Hub — every hub on the platform, whichever chợ it serves.
 *
 * The chợ page's hub tab shows the one hub that chợ has; this is the other
 * question — "what does the network look like" — which that tab cannot answer
 * because it only ever sees one row. Same {@link createHubResource} definition
 * unscoped, so columns, fields and limits cannot drift between the two.
 *
 * A row opens the hub's own page, where its staff roster and inbound oversight
 * live.
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
    private readonly _transloco = inject(TranslocoService);

    readonly resource: CrudResource = createHubResource(
        this._logistics,
        this._router,
        (key) => this._transloco.translate(key)
    );
}
