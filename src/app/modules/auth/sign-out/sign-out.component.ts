import { I18nPluralPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from 'app/core/auth/auth.service';
import { Subject, finalize, takeUntil, takeWhile, tap, timer } from 'rxjs';

@Component({
    selector: 'auth-sign-out',
    templateUrl: './sign-out.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [RouterLink, I18nPluralPipe],
})
export class AuthSignOutComponent implements OnInit, OnDestroy {
    countdown: number = 5;
    countdownMapping: any = {
        '=1': '# second',
        other: '# seconds',
    };
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(private _authService: AuthService) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Sign out
        this._authService.signOut().subscribe();

        // Redirect after the countdown.
        //
        // A document load, not a router navigation: clearing storage and
        // emitting a null user covers what listens for the session ending, but
        // every root service that cached something for the last account — the
        // restaurant profile, its addresses, the order lists — would otherwise
        // still be holding it when the next person signs in from this tab.
        // Starting the app again is the one way to be sure nothing carries over.
        timer(1000, 1000)
            .pipe(
                finalize(() => {
                    window.location.assign('/sign-in');
                }),
                takeWhile(() => this.countdown > 0),
                takeUntil(this._unsubscribeAll),
                tap(() => this.countdown--)
            )
            .subscribe();
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
