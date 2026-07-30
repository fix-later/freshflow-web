import { inject } from '@angular/core';
import { ActivatedRouteSnapshot } from '@angular/router';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { Area } from 'app/core/navigation/navigation.types';

/**
 * Resolves the chrome the shell needs before a route renders — currently just
 * the navigation for the route block's area (see `data.area` in app.routes.ts).
 *
 * Notifications load lazily from the header trigger itself (a real API call
 * that can fail independently — see NotificationsComponent), so they must not
 * block route resolution here.
 */
export const initialDataResolver = (route: ActivatedRouteSnapshot) => {
    const navigationService = inject(NavigationService);
    const area = (route.data['area'] as Area | undefined) ?? 'storefront';

    return navigationService.get(area);
};
