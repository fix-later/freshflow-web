import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Lets any part of the app (notably the API client's 401 handling) request
 * the header's quick sign-in popup. The panel component subscribes while it
 * is mounted; `open()` reports whether anyone is listening so callers can
 * fall back to the sign-in page when no popup is available.
 */
@Injectable({ providedIn: 'root' })
export class QuickSignInService {
    private _open = new Subject<void>();

    /** Emits when the quick sign-in panel should open. */
    get open$(): Observable<void> {
        return this._open.asObservable();
    }

    /** Request the panel; true when a mounted panel will handle it. */
    open(): boolean {
        if (!this._open.observed) {
            return false;
        }
        this._open.next();
        return true;
    }
}
