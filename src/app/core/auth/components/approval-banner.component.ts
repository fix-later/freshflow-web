import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@jsverse/transloco';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';

/**
 * Inline notice shown to a PENDING_APPROVAL restaurant (BR-AUTH-1): the account
 * can browse, but ordering stays disabled until an admin approves it.
 */
@Component({
    selector: 'approval-banner',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatIconModule, TranslocoModule],
    template: `
        @if (permissions.isPendingApproval()) {
            <div
                class="block flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 py-2 text-amber-800"
                *transloco="let t"
            >
                <mat-icon
                    class="text-amber-500 icon-size-5"
                    [svgIcon]="'heroicons_outline:clock'"
                ></mat-icon>
                <div>
                    <div class="font-medium">
                        {{ t('approvalBanner.title') }}
                    </div>
                    <div class="text-sm">
                        {{ t('approvalBanner.description') }}
                    </div>
                </div>
            </div>
        }
    `,
})
export class ApprovalBannerComponent {
    readonly permissions = inject(PermissionsService);
}
