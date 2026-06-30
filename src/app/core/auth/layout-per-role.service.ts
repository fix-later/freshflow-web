import { effect, inject, Injectable } from '@angular/core';
import { FuseConfigService } from '@fuse/services/config';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { UserRole } from 'app/core/user/user.types';

/** Fuse layout per role (specs/ux/NAVIGATION.md § Layout per role). */
const LAYOUT_BY_ROLE: Record<UserRole, string> = {
    restaurant: 'enterprise', // customer-facing, horizontal top nav
    admin: 'classic', // dense admin console, vertical side nav
    operations_manager: 'classic', // operational density, vertical side nav
};

/**
 * Keeps the active Fuse layout in sync with the signed-in user's role. Eagerly
 * instantiated via {@link provideAuth}; the effect re-runs whenever the role
 * changes (sign-in / sign-out).
 */
@Injectable({ providedIn: 'root' })
export class LayoutPerRoleService {
    private _fuseConfigService = inject(FuseConfigService);
    private _permissionsService = inject(PermissionsService);

    constructor() {
        effect(() => {
            const role = this._permissionsService.role();
            if (role) {
                this._fuseConfigService.config = {
                    layout: LAYOUT_BY_ROLE[role],
                };
            }
        });
    }
}
