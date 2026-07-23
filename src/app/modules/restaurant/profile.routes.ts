import { Routes } from '@angular/router';
import { roleGuard } from 'app/core/auth/guards/role.guard';
import { ProfileComponent } from './profile.component';

/**
 * Restaurant self-service profile area (`/profile`, M2). Restaurant-only:
 * `roleGuard` redirects guests to sign-in and other roles to `/home`, keeping
 * RBAC server-authoritative (BR-AUTH-4) while blocking unauthorized deep-links.
 */
export default [
    {
        path: '',
        canActivate: [roleGuard(['restaurant'])],
        component: ProfileComponent,
    },
] as Routes;
