import {
    Directive,
    effect,
    inject,
    input,
    TemplateRef,
    ViewContainerRef,
} from '@angular/core';
import { Permission } from 'app/core/auth/permissions/permissions';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { UserRole } from 'app/core/user/user.types';

/** Shared show/hide logic for the RBAC structural directives. */
abstract class RbacStructuralDirective {
    protected readonly permissions = inject(PermissionsService);
    private readonly _templateRef = inject(TemplateRef<unknown>);
    private readonly _viewContainer = inject(ViewContainerRef);
    private _visible = false;

    protected abstract allowed(): boolean;

    constructor() {
        effect(() => {
            const allowed = this.allowed();
            if (allowed && !this._visible) {
                this._viewContainer.createEmbeddedView(this._templateRef);
                this._visible = true;
            } else if (!allowed && this._visible) {
                this._viewContainer.clear();
                this._visible = false;
            }
        });
    }
}

/**
 * Renders its content only when the signed-in role is granted the capability.
 *
 * @example <button *hasPermission="'catalog:manage'">Add product</button>
 */
@Directive({ selector: '[hasPermission]', standalone: true })
export class HasPermissionDirective extends RbacStructuralDirective {
    readonly hasPermission = input.required<Permission>();
    protected allowed(): boolean {
        return this.permissions.has(this.hasPermission());
    }
}

/**
 * Renders its content only when the signed-in role matches.
 *
 * @example <a *hasRole="['admin','operations_manager']">Operations</a>
 */
@Directive({ selector: '[hasRole]', standalone: true })
export class HasRoleDirective extends RbacStructuralDirective {
    readonly hasRole = input.required<UserRole | UserRole[]>();
    protected allowed(): boolean {
        return this.permissions.hasRole(this.hasRole());
    }
}

/**
 * Renders its content only when the account is approved (BR-AUTH-1). Use to gate
 * ordering actions for PENDING_APPROVAL restaurants.
 *
 * @example <button *ifApproved>Place order</button>
 */
@Directive({ selector: '[ifApproved]', standalone: true })
export class IfApprovedDirective extends RbacStructuralDirective {
    protected allowed(): boolean {
        return this.permissions.isApproved();
    }
}
