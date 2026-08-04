import { Routes } from '@angular/router';
import { AuthGuard } from 'app/core/auth/guards/auth.guard';
import { SettingsPageComponent } from './settings-page.component';

/**
 * `/settings` — placeholder page (no settings API exists yet). Any
 * authenticated user may open it, matching `/profile`'s guard: `AuthGuard`
 * only redirects guests to sign-in.
 */
export default [
    {
        path: '',
        canActivate: [AuthGuard],
        component: SettingsPageComponent,
    },
] as Routes;
