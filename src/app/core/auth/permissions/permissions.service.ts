import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserService } from 'app/core/user/user.service';
import { UserRole } from 'app/core/user/user.types';
import { Permission, roleHasPermission } from './permissions';

/**
 * Reactive authorization checks for the UI, driven by the signed-in user's role
 * (from the JWT `role` claim) and approval status. Server stays authoritative
 * (BR-AUTH-4) — this only governs what the UI exposes.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
    private _userService = inject(UserService);
    private _user = toSignal(this._userService.user$, { initialValue: null });

    /** The signed-in user's role, or `null` when signed out. */
    readonly role = computed<UserRole | null>(() => this._user()?.role ?? null);

    /** Restaurants must be approved to act; other roles are always "approved". */
    readonly isApproved = computed<boolean>(() => {
        const user = this._user();
        if (!user) {
            return false;
        }
        return user.role !== 'restaurant' || user.approvalStatus === 'approved';
    });

    /** True while a restaurant account awaits admin approval (BR-AUTH-1). */
    readonly isPendingApproval = computed<boolean>(
        () =>
            this.role() === 'restaurant' &&
            this._user()?.approvalStatus === 'pending'
    );

    /** True if the current role is granted `permission`. */
    has(permission: Permission): boolean {
        return roleHasPermission(this.role(), permission);
    }

    /** True if the current role is one of `roles`. */
    hasRole(roles: UserRole | UserRole[]): boolean {
        const role = this.role();
        if (!role) {
            return false;
        }
        return Array.isArray(roles) ? roles.includes(role) : roles === role;
    }

    /** Ordering requires the capability AND an approved account (BR-AUTH-1). */
    canPlaceOrders(): boolean {
        return this.has('orders:create') && this.isApproved();
    }
}
