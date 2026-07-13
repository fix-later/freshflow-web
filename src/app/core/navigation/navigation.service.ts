import { inject, Injectable } from '@angular/core';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { buildNavigation } from 'app/core/navigation/navigation.data';
import { Area, Navigation } from 'app/core/navigation/navigation.types';
import { Observable, of, ReplaySubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationService {
    private _permissions = inject(PermissionsService);
    private _navigation: ReplaySubject<Navigation> =
        new ReplaySubject<Navigation>(1);
    /** Area of the last build — lets `get()` refresh in place on role change. */
    private _lastArea: Area = 'storefront';

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for navigation
     */
    get navigation$(): Observable<Navigation> {
        return this._navigation.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Build the navigation for `area`, filtered by the signed-in role
     * (guests see the public storefront items). Called with the route
     * block's area by the initial-data resolver; calling with no argument
     * rebuilds the current area — used after quick sign-in, where the user
     * stays on the page but the role changed.
     */
    get(area: Area = this._lastArea): Observable<Navigation> {
        this._lastArea = area;
        const items = buildNavigation(area, this._permissions.role());
        const navigation: Navigation = {
            compact: items,
            default: items,
            futuristic: items,
            horizontal: items,
        };
        this._navigation.next(navigation);
        return of(navigation);
    }
}
