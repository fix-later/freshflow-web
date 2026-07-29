import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.types';
import { firstValueFrom } from 'rxjs';

/**
 * Basic personal-account editor for non-restaurant roles (admin, operations
 * manager) — the restaurant role gets the full self-service area instead
 * (business/tax profile, delivery addresses, credit, orders, invoices).
 * Backed by `GET/PUT /profile/me` via the existing `UserService`.
 */
@Component({
    selector: 'account-info',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './account-info.component.html',
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule,
        TranslocoModule,
    ],
})
export class AccountInfoComponent implements OnInit {
    private readonly _fb = inject(FormBuilder);
    private readonly _userService = inject(UserService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly saving = signal(false);
    readonly email = signal('');
    readonly avatarUrl = signal<string | null>(null);

    readonly form = this._fb.group({
        fullName: this._fb.control('', { nonNullable: true }),
        phone: this._fb.control('', { nonNullable: true }),
    });

    ngOnInit(): void {
        const user = this._userService.current;
        if (user) {
            this._apply(user);
        }
    }

    async save(): Promise<void> {
        const current = this._userService.current;
        if (!current || this.saving()) {
            return;
        }
        const v = this.form.getRawValue();
        this.saving.set(true);
        try {
            await firstValueFrom(
                this._userService.update({
                    ...current,
                    fullName: v.fullName.trim() || null,
                    phone: v.phone.trim() || null,
                })
            );
            this._toast('accountInfo.saved');
        } catch {
            this._toast('accountInfo.saveError');
        } finally {
            this.saving.set(false);
        }
    }

    private _apply(user: User): void {
        this.email.set(user.email);
        this.avatarUrl.set(user.avatarUrl ?? null);
        this.form.reset({
            fullName: user.fullName ?? '',
            phone: user.phone ?? '',
        });
    }

    private _toast(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }
}
