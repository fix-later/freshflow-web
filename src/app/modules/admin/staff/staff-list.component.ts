import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { createStaffResource } from './staff-resource';

/** Admin ▸ Quản trị ▸ Nhân sự — the platform-wide roster of who works where. */
@Component({
    selector: 'admin-staff-list',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class StaffListComponent {
    private readonly _admin = inject(AdminService);
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly resource: CrudResource = createStaffResource(
        this._admin,
        this._logistics,
        this._router,
        (key) => this._transloco.translate(key)
    );
}
