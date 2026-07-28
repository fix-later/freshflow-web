import {
    ChangeDetectionStrategy,
    Component,
    Input,
    ViewEncapsulation,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Centered spinner + label shown while an admin page's data is still being
 * fetched (as opposed to `admin.crud.empty`, which means the fetch finished
 * and returned nothing). One component so every list/detail page renders the
 * same loading state instead of going blank between the header progress bar
 * and the empty-state message.
 */
@Component({
    selector: 'admin-loading-state',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatProgressSpinnerModule, TranslocoModule],
    template: `
        <div
            class="flex flex-auto flex-col items-center justify-center gap-3 p-16"
            role="status"
            [attr.aria-label]="t(label)"
            *transloco="let t"
        >
            <mat-progress-spinner
                mode="indeterminate"
                [diameter]="40"
                color="primary"
            ></mat-progress-spinner>
            <span class="text-secondary text-sm font-medium">{{
                t(label)
            }}</span>
        </div>
    `,
})
export class AdminLoadingStateComponent {
    /** i18n key for the label; defaults to the generic "Loading…" copy. */
    @Input() label = 'admin.crud.loading';
}
