import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    TemplateRef,
    ViewChild,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    FormBuilder,
    FormGroupDirective,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { FuseAlertComponent } from '@fuse/components/alert';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from 'app/core/auth/auth.service';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { QuickSignInService } from 'app/layout/common/quick-sign-in/quick-sign-in.service';

/**
 * Quick sign-in: a centered popup dialog with the credentials form, so
 * guests can sign in without leaving the page. On success the dialog closes
 * and the role-driven UI (navigation, theme, user menu) updates in place.
 */
@Component({
    selector: 'quick-sign-in',
    templateUrl: './quick-sign-in.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        FuseAlertComponent,
        ReactiveFormsModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class QuickSignInComponent implements OnDestroy {
    @ViewChild('quickSignInPanel') private _panel: TemplateRef<unknown>;

    private _authService = inject(AuthService);
    private _changeDetectorRef = inject(ChangeDetectorRef);
    private _dialog = inject(MatDialog);
    private _formBuilder = inject(FormBuilder);
    private _navigationService = inject(NavigationService);

    private _dialogRef: MatDialogRef<unknown> | null = null;

    showError = false;

    /** `identifier` accepts an email or a phone (BR-AUTH-2). */
    signInForm = this._formBuilder.nonNullable.group({
        identifier: ['', [Validators.required]],
        password: ['', [Validators.required]],
    });

    constructor() {
        // Open on demand — e.g. when a guest request hits a protected API.
        inject(QuickSignInService)
            .open$.pipe(takeUntilDestroyed())
            .subscribe(() => this.openPanel());
    }

    ngOnDestroy(): void {
        this._dialogRef?.close();
    }

    openPanel(): void {
        if (!this._panel || this._dialogRef) {
            return;
        }
        this._dialogRef = this._dialog.open(this._panel, {
            width: '24rem',
            maxWidth: 'calc(100vw - 2rem)',
            autoFocus: 'input',
        });
        // Backdrop click / Escape also land here — one reset path.
        this._dialogRef.afterClosed().subscribe(() => {
            this._dialogRef = null;
            this.showError = false;
            this.signInForm.enable();
            this.signInForm.reset();
        });
    }

    closePanel(): void {
        this._dialogRef?.close();
    }

    signIn(ngForm: FormGroupDirective): void {
        if (this.signInForm.invalid) {
            return;
        }
        const credentials = this.signInForm.getRawValue();
        this.signInForm.disable();
        this.showError = false;

        this._authService.signIn(credentials).subscribe({
            next: () => {
                // Stay on the page: rebuild the role-filtered navigation;
                // the user menu and theme react to the role signal.
                this._navigationService.get().subscribe();
                this.closePanel();
            },
            error: () => {
                this.signInForm.enable();
                // Reset the submitted state too, so the cleared password
                // field doesn't flag "required" under the error alert.
                ngForm.resetForm({
                    identifier: credentials.identifier,
                    password: '',
                });
                this.showError = true;
                this._changeDetectorRef.markForCheck();
            },
        });
    }
}
