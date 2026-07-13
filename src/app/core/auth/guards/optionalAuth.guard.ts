import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn } from '@angular/router';
import { AuthService } from 'app/core/auth/auth.service';
import { map } from 'rxjs';

/**
 * Public routes that adapt to auth state (e.g. the guest-browsable home):
 * restores the session when a token is present — so signed-in users keep
 * their role/theme/header state — but always allows access.
 */
export const OptionalAuthGuard: CanActivateFn | CanActivateChildFn = () => {
    return inject(AuthService)
        .check()
        .pipe(map(() => true));
};
