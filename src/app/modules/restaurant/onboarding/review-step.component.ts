import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    output,
    ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { SetupCompletionService } from '../setup/setup-completion.service';
import { RequiredSetupItemId } from '../setup/setup.types';

/**
 * Closing step of the onboarding wizard: what was provided, what is still
 * missing, and what happens next.
 *
 * The wording is the point of this component. There is **no**
 * submit-for-approval endpoint on `RestaurantProfileApi` — only a way to read
 * the current approval standing — so this step posts nothing and must never
 * present a button implying the account was submitted (FR-014). It explains
 * that an administrator reviews the account and that ordering stays
 * unavailable until then (BR-AUTH-1).
 */
@Component({
    selector: 'onboarding-review-step',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './review-step.component.html',
    imports: [MatButtonModule, MatIconModule, TranslocoModule],
})
export class ReviewStepComponent {
    private readonly _completion = inject(SetupCompletionService);
    private readonly _userService = inject(UserService);

    /** Asks the wizard to open the step that completes `item`. */
    readonly openItem = output<RequiredSetupItemId>();

    private readonly _user = toSignal(this._userService.user$, {
        initialValue: this._userService.current,
    });

    readonly progress = this._completion.progress;
    readonly states = this._completion.states;

    /**
     * The account's real standing, so the closing copy matches it rather than
     * assuming "pending" (FR-015).
     *
     * The client's `ApprovalStatus` is `pending | approved | rejected` — there
     * is no `suspended` member despite the spec's wording; `rejected` is the
     * state that must not be told "finishing this will restore ordering".
     */
    readonly approvalStatus = computed(
        () => this._user()?.approvalStatus ?? 'pending'
    );

    /** Translation key for the what-happens-next explanation. */
    readonly outcomeKey = computed(() => {
        switch (this.approvalStatus()) {
            case 'approved':
                return 'restaurantOnboarding.review.outcome.approved';
            case 'rejected':
                return 'restaurantOnboarding.review.outcome.rejected';
            default:
                return this.progress().isComplete
                    ? 'restaurantOnboarding.review.outcome.pendingComplete'
                    : 'restaurantOnboarding.review.outcome.pendingIncomplete';
        }
    });

    /** Label key for a required item, used by both the done and missing lists. */
    itemLabelKey(item: RequiredSetupItemId): string {
        return `restaurantOnboarding.items.${item}`;
    }

    /** Required items already satisfied, for the summary. */
    readonly doneItems = computed(() => {
        const states = this.states();
        return (['business', 'license', 'address'] as const).filter(
            (id) => states[id] === 'done'
        );
    });
}
