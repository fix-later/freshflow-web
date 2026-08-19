import { DOCUMENT, inject, Injectable } from '@angular/core';
import {
    NavigationCancel,
    NavigationEnd,
    NavigationError,
    NavigationSkipped,
    Router,
} from '@angular/router';
import { filter, take } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FuseSplashScreenService {
    private _document = inject(DOCUMENT);
    private _router = inject(Router);

    /**
     * Constructor
     */
    constructor() {
        // Hide it once the first navigation is over, however it ended.
        //
        // `NavigationEnd` alone is not enough: a guard that rejects or a
        // resolver that throws ends the first navigation in `NavigationCancel` /
        // `NavigationError`, and the splash then covers the app for the rest of
        // the session — a spinner with nothing behind it and no way out but a
        // reload. Whatever the outcome, the navigation is settled and the
        // splash has to come off.
        this._router.events
            .pipe(
                filter(
                    (event) =>
                        event instanceof NavigationEnd ||
                        event instanceof NavigationCancel ||
                        event instanceof NavigationError ||
                        event instanceof NavigationSkipped
                ),
                take(1)
            )
            .subscribe(() => {
                this.hide();
            });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Show the splash screen
     */
    show(): void {
        this._document.body.classList.remove('fuse-splash-screen-hidden');
    }

    /**
     * Hide the splash screen
     */
    hide(): void {
        this._document.body.classList.add('fuse-splash-screen-hidden');
    }
}
