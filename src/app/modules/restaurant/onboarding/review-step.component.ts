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
import { RestaurantProfileService } from '../restaurant-profile.service';
import { SetupCompletionService } from '../setup/setup-completion.service';
import { RequiredSetupItemId } from '../setup/setup.types';

/**
 * Sections the review step can send the restaurant back to.
 *
 * Wider than {@link RequiredSetupItemId} because the review shows the optional
 * tax section too: it has no verifiable state (there is no GET for the tax
 * profile) so it is not a required item, but it is still summarised here and
 * still needs an edit route back to its step.
 */
export type ReviewSectionId = RequiredSetupItemId | 'tax';

/** One `label: value` line inside a summary card. */
interface SummaryRow {
    labelKey: string;
    /** Empty when the restaurant has not provided this field. */
    value: string;
}

/**
 * Closing step of the onboarding wizard: everything that was entered, what is
 * still missing, and what happens next.
 *
 * It restates the saved values rather than ticking off section names — a review
 * that only says "business profile ✓" gives the restaurant nothing to check,
 * and the whole point of this step is catching a typo before an admin reads it.
 * Values are read back from {@link RestaurantProfileService}'s signals, so they
 * are what the server stored, not what the forms currently hold.
 *
 * The wording is the other half of this component. There is **no**
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
    styleUrl: './review-step.component.scss',
    imports: [MatButtonModule, MatIconModule, TranslocoModule],
})
export class ReviewStepComponent {
    private readonly _completion = inject(SetupCompletionService);
    private readonly _profile = inject(RestaurantProfileService);
    private readonly _userService = inject(UserService);

    /** Asks the wizard to open the step that owns `section`. */
    readonly openSection = output<ReviewSectionId>();

    private readonly _user = toSignal(this._userService.user$, {
        initialValue: this._userService.current,
    });

    readonly progress = this._completion.progress;
    readonly states = this._completion.states;

    readonly addresses = this._profile.deliveryAddresses;

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

    /** Label key for a required item, used by the outstanding list. */
    itemLabelKey(item: RequiredSetupItemId): string {
        return `restaurantOnboarding.items.${item}`;
    }

    /**
     * The business step's saved values, plus the two the account already
     * carries: setup never asks for the sign-in email or phone, but they are
     * part of what an admin sees, so leaving them off would make this a partial
     * summary of a screen that claims to be the full one.
     */
    readonly businessRows = computed<SummaryRow[]>(() => {
        const profile = this._profile.profile();
        const user = this._user();
        return [
            row('restaurantProfile.profile.name', profile?.name),
            row('restaurantProfile.profile.address', profile?.address),
            row(
                'restaurantProfile.profile.contactPerson',
                profile?.contactPerson
            ),
            row('restaurantOnboarding.review.accountEmail', user?.email),
            row('restaurantOnboarding.review.accountPhone', user?.phone),
        ];
    });

    /** Uploaded licence image, or `null` while the item is outstanding. */
    readonly licenseUrl = computed(
        () => this._profile.profile()?.businessLicenseUrl?.trim() || null
    );

    /** The optional tax/invoice values. */
    readonly taxRows = computed<SummaryRow[]>(() => {
        const profile = this._profile.profile();
        return [
            row('restaurantProfile.taxProfile.taxCode', profile?.taxCode),
            row(
                'restaurantProfile.taxProfile.legalName',
                profile?.invoiceLegalName
            ),
            row(
                'restaurantProfile.taxProfile.address',
                profile?.invoiceAddress
            ),
            row('restaurantProfile.taxProfile.email', profile?.invoiceEmail),
        ];
    });

    /**
     * Whether the tax section has anything to show. Skipping it is a valid
     * outcome, so the card says so plainly instead of listing four blanks.
     */
    readonly hasTax = computed(() => this.taxRows().some((r) => !!r.value));
}

/** Trims a nullable field into a row the template can render either way. */
function row(labelKey: string, value: string | null | undefined): SummaryRow {
    return { labelKey, value: (value ?? '').trim() };
}
