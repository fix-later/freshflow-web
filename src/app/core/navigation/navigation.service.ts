import { inject, Injectable } from '@angular/core';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { buildNavigation } from 'app/core/navigation/navigation.data';
import { Navigation } from 'app/core/navigation/navigation.types';
import { Observable, of, ReplaySubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationService {
    private _permissions = inject(PermissionsService);
    private _navigation: ReplaySubject<Navigation> =
        new ReplaySubject<Navigation>(1);

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
     * Build the role-filtered navigation for the signed-in user (BR-AUTH-4).
     * The same item set feeds every Fuse layout variant.
     */
    get(): Observable<Navigation> {
        const items = buildNavigation(this._permissions.role());
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
