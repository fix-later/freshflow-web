import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import {
    FormsModule,
    ReactiveFormsModule,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FuseAlertComponent, FuseAlertType } from '@fuse/components/alert';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { AuthService } from 'app/core/auth/auth.service';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { UserService } from 'app/core/user/user.service';
import { AuthBrandPanelComponent } from 'app/modules/auth/brand-panel/auth-brand-panel.component';
import { SetupCompletionService } from 'app/modules/restaurant/setup/setup-completion.service';

@Component({
    selector: 'auth-sign-in',
    templateUrl: './sign-in.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        RouterLink,
        FuseAlertComponent,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        TranslocoModule,
        AuthBrandPanelComponent,
    ],
})
export class AuthSignInComponent implements OnInit {
    alert: { type: FuseAlertType; message: string } = {
        type: 'success',
        message: '',
    };
    signInForm: UntypedFormGroup;
    showAlert: boolean = false;

    /**
     * Constructor
     */
    constructor(
        private _activatedRoute: ActivatedRoute,
        private _authService: AuthService,
        private _formBuilder: UntypedFormBuilder,
        private _permissions: PermissionsService,
        private _router: Router,
        private _setupCompletion: SetupCompletionService,
        private _translocoService: TranslocoService,
        private _userService: UserService
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Create the form. `identifier` accepts an email or a phone (BR-AUTH-2).
        this.signInForm = this._formBuilder.group({
            identifier: ['', [Validators.required]],
            password: ['', Validators.required],
            rememberMe: [''],
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Sign in
     */
    signIn(): void {
        // Return if the form is invalid
        if (this.signInForm.invalid) {
            return;
        }

        // Disable the form
        this.signInForm.disable();

        // Hide the alert
        this.showAlert = false;

        // Sign in
        this._authService.signIn(this.signInForm.value).subscribe({
            next: () => {
                // The profile (and role) is loaded by the time signIn resolves,
                // so resolve the landing page here and navigate directly — a
                // synchronous `redirectTo` can't reliably read the async role.
                void this._navigateAfterSignIn();
            },
            error: (err: unknown) => void this._handleSignInFailure(err),
        });
    }

    /**
     * Distinguishes wrong credentials from an account lock, a network drop, or
     * a 5xx — `describeApiError` already maps every one of those codes, so
     * showing a bare "wrong credentials" for all of them was hiding the real
     * reason (and telling a locked-out or offline user to just try again).
     * Only the password is cleared: wiping `identifier` too made a single typo
     * in the password force retyping the email/phone as well.
     */
    private async _handleSignInFailure(err: unknown): Promise<void> {
        this.signInForm.enable();
        this.signInForm.controls['password'].reset();

        this.alert = {
            type: 'error',
            message: await describeApiError(
                err,
                (key) => this._translocoService.translate(key),
                'auth.errors.wrongCredentials'
            ),
        };
        this.showAlert = true;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Where to land after a successful sign-in.
     *
     * An explicit `redirectURL` always wins, so a deep link into the app is
     * never hijacked. Otherwise a restaurant whose setup is not yet reviewable
     * is guided into `/onboarding` (FR-002) — the wizard it can leave at any
     * time — and everyone else lands on their usual per-role page.
     */
    private async _navigateAfterSignIn(): Promise<void> {
        const explicitURL =
            this._activatedRoute.snapshot.queryParamMap.get('redirectURL');
        if (explicitURL) {
            await this._router.navigateByUrl(explicitURL);
            return;
        }

        if (await this._needsOnboarding()) {
            await this._router.navigateByUrl('/onboarding');
            return;
        }

        await this._router.navigateByUrl(this._permissions.landingUrl());
    }

    /**
     * See `specs/003-restaurant-onboarding-wizard/data-model.md` § 5 — every
     * clause here maps to a requirement, and an approved or already-complete
     * restaurant is never pulled in.
     */
    private async _needsOnboarding(): Promise<boolean> {
        if (!this._permissions.hasRole('restaurant')) {
            return false;
        }
        if (this._userService.current?.approvalStatus === 'approved') {
            return false;
        }
        if (this._setupCompletion.isDismissed()) {
            return false;
        }

        // Fresh read: a profile completed in an earlier session must not send
        // the restaurant back through the wizard.
        this._setupCompletion.invalidate();
        await this._setupCompletion.load();
        return !this._setupCompletion.progress().isComplete;
    }
}
