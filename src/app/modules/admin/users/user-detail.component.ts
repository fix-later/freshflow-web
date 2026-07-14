import { Location } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';

/**
 * Admin ▸ User detail. There is no `GET /admin/users/{userId}` endpoint, so
 * the base profile (email/role/status) comes from the row the list screen
 * passed via router navigation `state` (falls back to just the id from the
 * route param). Market assignments always come live from their own GET.
 */
@Component({
    selector: 'admin-user-detail',
    templateUrl: './user-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class UserDetailComponent implements OnInit {
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _location = inject(Location);
    private readonly _admin = inject(AdminService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);

    readonly userId = this._route.snapshot.params['userId'] as string;
    readonly user = signal<AdminUserRow | null>(null);
    readonly roles = signal<string[]>([]);
    readonly markets = signal<{ id: string; name: string }[]>([]);
    readonly assignedMarketIds = signal<Set<string>>(new Set());

    readonly loadingAssignments = signal(false);
    readonly savingRole = signal(false);
    readonly savingActive = signal(false);
    readonly savingAssignments = signal(false);
    readonly unlocking = signal(false);

    readonly roleForm = this._formBuilder.nonNullable.group({
        role: ['', Validators.required],
    });

    ngOnInit(): void {
        const stateUser = (this._location.getState() as { user?: AdminUserRow })
            ?.user;
        this.user.set(stateUser ?? { id: this.userId });
        this.roleForm.patchValue({ role: stateUser?.role ?? '' });

        this._admin
            .getRoles()
            .then((roles) => this.roles.set(roles))
            .catch(() => this.roles.set([]));

        this._admin
            .getMarkets()
            .then((markets) => this.markets.set(markets))
            .catch(() => this.markets.set([]));

        this._loadAssignments();
    }

    goBack(): void {
        this._router.navigate(['/admin/users']);
    }

    saveRole(): void {
        if (this.roleForm.invalid) {
            return;
        }
        const roleName = this.roleForm.getRawValue().role;
        this.savingRole.set(true);
        this._admin
            .assignRole(this.userId, roleName)
            .then(() => {
                this.user.update((u) => (u ? { ...u, role: roleName } : u));
                this._notify('admin.userDetail.role.success');
            })
            .catch(() => this._notify('admin.userDetail.actionError'))
            .finally(() => this.savingRole.set(false));
    }

    toggleActive(): void {
        const current = this.user();
        if (!current) {
            return;
        }
        const nextActive = !current.isActive;
        this.savingActive.set(true);
        this._admin
            .setUserActive(this.userId, nextActive)
            .then(() => {
                this.user.update((u) =>
                    u ? { ...u, isActive: nextActive } : u
                );
                this._notify(
                    nextActive
                        ? 'admin.users.activate.success'
                        : 'admin.users.deactivate.success'
                );
            })
            .catch(() => this._notify('admin.userDetail.actionError'))
            .finally(() => this.savingActive.set(false));
    }

    unlock(): void {
        this.unlocking.set(true);
        this._admin
            .unlockUser(this.userId)
            .then(() => {
                this.user.update((u) => (u ? { ...u, lockedUntil: null } : u));
                this._notify('admin.users.unlock.success');
            })
            .catch(() => this._notify('admin.userDetail.actionError'))
            .finally(() => this.unlocking.set(false));
    }

    toggleMarket(marketId: string): void {
        this.assignedMarketIds.update((set) => {
            const next = new Set(set);
            if (next.has(marketId)) {
                next.delete(marketId);
            } else {
                next.add(marketId);
            }
            return next;
        });
    }

    isMarketAssigned(marketId: string): boolean {
        return this.assignedMarketIds().has(marketId);
    }

    saveAssignments(): void {
        this.savingAssignments.set(true);
        this._admin
            .replaceMarketAssignments(
                this.userId,
                Array.from(this.assignedMarketIds())
            )
            .then(() => this._notify('admin.userDetail.assignments.success'))
            .catch(() => this._notify('admin.userDetail.actionError'))
            .finally(() => this.savingAssignments.set(false));
    }

    private _loadAssignments(): void {
        this.loadingAssignments.set(true);
        this._admin
            .getMarketAssignments(this.userId)
            .then((ids) => this.assignedMarketIds.set(new Set(ids)))
            .catch(() => this.assignedMarketIds.set(new Set()))
            .finally(() => this.loadingAssignments.set(false));
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }
}
