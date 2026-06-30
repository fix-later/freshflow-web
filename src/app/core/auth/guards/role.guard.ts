import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from 'app/core/auth/auth.service';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { UserRole } from 'app/core/user/user.types';
import { map } from 'rxjs';

/**
 * Route guard factory: requires authentication **and** one of `allowedRoles`.
 *
 * - not authenticated → redirect to `/sign-in` (preserving the target URL)
 * - authenticated but wrong role → redirect to `/home`
 *
 * RBAC stays server-authoritative (BR-AUTH-4); this only stops unauthorized
 * deep-links from rendering.
 *
 * @example
 * { path: 'admin', canActivate: [roleGuard(['admin'])], ... }
 */
export const roleGuard = (
    allowedRoles: UserRole[]
): CanActivateFn & CanActivateChildFn => {
    return (route, state) => {
        const router = inject(Router);
        const permissionsService = inject(PermissionsService);

        return inject(AuthService)
            .check()
            .pipe(
                map((authenticated) => {
                    if (!authenticated) {
                        const redirectURL =
                            state.url === '/sign-out'
                                ? ''
                                : `redirectURL=${state.url}`;
                        return router.parseUrl(`sign-in?${redirectURL}`);
                    }

                    if (permissionsService.hasRole(allowedRoles)) {
                        return true;
                    }

                    // Authenticated but not permitted — bounce to a safe page.
                    return router.parseUrl('home');
                })
            );
    };
};
