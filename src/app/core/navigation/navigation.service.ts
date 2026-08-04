import { inject, Injectable } from '@angular/core';
import { FuseNavigationItem } from '@fuse/components/navigation';
import { TranslocoService } from '@jsverse/transloco';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { ConsoleModeService } from 'app/core/navigation/console-mode.service';
import { buildNavigation } from 'app/core/navigation/navigation.data';
import { Area, Navigation } from 'app/core/navigation/navigation.types';
import { Observable, of, ReplaySubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationService {
    private _permissions = inject(PermissionsService);
    private _consoleMode = inject(ConsoleModeService);
    private _transloco = inject(TranslocoService);
    private _navigation: ReplaySubject<Navigation> =
        new ReplaySubject<Navigation>(1);
    /** Area of the last build — lets `get()` refresh in place on role change. */
    private _lastArea: Area = 'storefront';

    constructor() {
        // Titles are i18n keys, resolved at build time below — so the nav has
        // to rebuild whenever the active translation changes, or the header
        // keeps the words it was first rendered with. Fuse's own nav
        // components read `item.title` as a plain string and cannot translate
        // it themselves.
        //
        // `selectTranslation()`, not `langChanges$`: the latter fires the
        // moment a language is *selected*, before its file has loaded, and
        // `translate()` at that point returns the key itself — which is
        // exactly what shipped in the nav row.
        this._transloco.selectTranslation().subscribe(() => this.get());
    }

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
     * stays on the page but the role changed, after a console-mode switch,
     * and on every language change.
     */
    get(area: Area = this._lastArea): Observable<Navigation> {
        this._lastArea = area;
        const items = this._translate(
            buildNavigation(
                area,
                this._permissions.role(),
                this._consoleMode.mode()
            )
        );
        const navigation: Navigation = {
            compact: items,
            default: items,
            futuristic: items,
            horizontal: items,
        };
        this._navigation.next(navigation);
        return of(navigation);
    }

    /**
     * Resolves each item's `title` key against the active language, copying
     * rather than mutating — `buildNavigation` returns the shared source data,
     * and translating it in place would leave the next language switch with
     * nothing but already-translated words to look up.
     */
    private _translate(items: FuseNavigationItem[]): FuseNavigationItem[] {
        return items.map((item) => ({
            ...item,
            title: item.title
                ? this._transloco.translate(item.title)
                : item.title,
            children: item.children
                ? this._translate(item.children)
                : undefined,
        }));
    }
}
