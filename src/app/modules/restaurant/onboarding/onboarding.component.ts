import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    signal,
    viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { BusinessProfileFormComponent } from '../business-profile/business-profile-form.component';
import { DeliveryAddressesComponent } from '../delivery-addresses/delivery-addresses.component';
import { SetupCompletionService } from '../setup/setup-completion.service';
import { TaxProfileFormComponent } from '../tax-profile/tax-profile-form.component';
import { OnboardingStep } from './onboarding-step.contract';
import { ReviewSectionId, ReviewStepComponent } from './review-step.component';

/** Wizard step order. The review step is last and saves nothing. */
const STEP_BUSINESS = 0;
const STEP_TAX = 1;
const STEP_ADDRESS = 2;
const STEP_REVIEW = 3;
const STEP_COUNT = 4;

/**
 * Which sections each data step is responsible for. Steps and sections are not
 * one-to-one: the business step covers two, because the licence is a field of
 * the same form and the same `PUT /restaurants/me/profile`.
 *
 * `tax` is here as a section but is not a required item — it has no verifiable
 * state (spec Decision 2), so it never counts towards progress; it is listed so
 * the review step's tax card can still send the restaurant back to it.
 */
const STEP_SECTIONS: ReadonlyArray<readonly ReviewSectionId[]> = [
    ['business', 'license'], // STEP_BUSINESS
    ['tax'], // STEP_TAX — optional, unverifiable
    ['address'], // STEP_ADDRESS
];

/**
 * Guided setup for a newly self-registered restaurant (`/onboarding`).
 *
 * Four steps — business profile (with the licence upload), tax/billing,
 * delivery address, review — that **embed the existing profile-area form
 * components** rather than reimplementing them. This component only
 * orchestrates: it tracks the step index, gates advancing on the active step's
 * save actually succeeding (FR-024), and lets the restaurant skip or leave.
 *
 * Two invariants worth protecting:
 *
 * - **One PUT for the business step.** `businessLicenseUrl` is a field of
 *   `BusinessProfileFormComponent`'s form. Splitting the licence into its own
 *   step would issue a second `PUT /restaurants/me/profile` that overwrites the
 *   first step's values (research R2).
 * - **The wizard never traps.** A pending restaurant may browse the catalogue
 *   (BR-AUTH-1), so exiting is always available (FR-003).
 *
 * See `specs/003-restaurant-onboarding-wizard/`.
 */
@Component({
    selector: 'restaurant-onboarding',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './onboarding.component.html',
    styleUrl: './onboarding.component.scss',
    imports: [
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        MatStepperModule,
        TranslocoModule,
        BusinessProfileFormComponent,
        TaxProfileFormComponent,
        DeliveryAddressesComponent,
        ReviewStepComponent,
    ],
})
export class OnboardingComponent implements OnInit {
    private readonly _completion = inject(SetupCompletionService);
    private readonly _router = inject(Router);

    private readonly _businessStep = viewChild(BusinessProfileFormComponent);
    private readonly _taxStep = viewChild(TaxProfileFormComponent);
    private readonly _addressStep = viewChild(DeliveryAddressesComponent);

    /**
     * The rail's step list. The stepper's own header is hidden — with a
     * permanent rail showing every step and its state, two progress indicators
     * on one screen just compete with each other.
     */
    readonly steps: ReadonlyArray<{
        labelKey: string;
        hintKey: string;
        optional: boolean;
    }> = [
        {
            labelKey: 'restaurantOnboarding.steps.business',
            hintKey: 'restaurantOnboarding.steps.businessHint',
            optional: false,
        },
        {
            labelKey: 'restaurantOnboarding.steps.tax',
            hintKey: 'restaurantOnboarding.steps.taxHint',
            optional: true,
        },
        {
            labelKey: 'restaurantOnboarding.steps.address',
            hintKey: 'restaurantOnboarding.steps.addressHint',
            optional: false,
        },
        {
            labelKey: 'restaurantOnboarding.steps.review',
            hintKey: 'restaurantOnboarding.steps.reviewHint',
            optional: false,
        },
    ];

    readonly stepIndex = signal(STEP_BUSINESS);
    readonly advancing = signal(false);
    readonly loading = signal(true);

    readonly progress = this._completion.progress;
    readonly stepCount = STEP_COUNT;

    readonly isReviewStep = computed(() => this.stepIndex() === STEP_REVIEW);
    readonly isOptionalStep = computed(() => this.stepIndex() === STEP_TAX);

    /** Human step position, 1-based, for "step N of 4" (FR-007). */
    readonly stepNumber = computed(() => this.stepIndex() + 1);

    /** Required items done, as a percentage — the rail's progress bar. */
    readonly progressPercent = computed(() => {
        const { completed, total } = this.progress();
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    });

    async ngOnInit(): Promise<void> {
        this.loading.set(true);
        // Read server state before choosing where to resume, so a returning
        // restaurant is not sent back to a step it already finished (FR-012).
        this._completion.invalidate();
        await this._completion.load();
        this.stepIndex.set(this._firstOutstandingStep());
        this.loading.set(false);
    }

    /** Save the active step and move on only if the write landed (FR-009). */
    async continue(): Promise<void> {
        if (this.advancing()) {
            return;
        }
        const index = this.stepIndex();

        if (index === STEP_REVIEW) {
            await this.finish();
            return;
        }

        this.advancing.set(true);
        try {
            if (await this._saveStep(index)) {
                this._goTo(index + 1);
            }
        } finally {
            this.advancing.set(false);
        }
    }

    /** Move on without saving; the step stays outstanding (FR-010). */
    skip(): void {
        const index = this.stepIndex();
        if (index < STEP_REVIEW) {
            this._goTo(index + 1);
        }
    }

    back(): void {
        this._goTo(Math.max(STEP_BUSINESS, this.stepIndex() - 1));
    }

    /** Jump to the step that owns `section` (from the review step). */
    openSection(section: ReviewSectionId): void {
        const index = STEP_SECTIONS.findIndex((sections) =>
            sections.includes(section)
        );
        if (index >= 0) {
            this._goTo(index);
        }
    }

    /**
     * Leave the wizard. Records a session-scoped dismissal so the restaurant is
     * not pulled straight back in, then returns to the storefront it is
     * entitled to browse (FR-003, FR-004).
     */
    exit(): void {
        this._completion.dismiss();
        void this._router.navigateByUrl('/home');
    }

    /** Finishing posts nothing — no submit endpoint exists (FR-014). */
    async finish(): Promise<void> {
        this._completion.dismiss();
        await this._router.navigateByUrl('/home');
    }

    /** Keep the signal in step with header clicks and stepper animations. */
    onSelectionChange(index: number): void {
        this.stepIndex.set(index);
    }

    /**
     * The address step's goal is "an address exists", not "the inline form is
     * valid" — so Continue is enabled once one is saved, and only forces a save
     * when the add form is actually open.
     */
    readonly canContinue = computed(() => {
        if (this.stepIndex() !== STEP_ADDRESS) {
            return true;
        }
        const step = this._addressStep();
        if (!step) {
            return true;
        }
        return step.formOpen() || step.addresses().length > 0;
    });

    private async _saveStep(index: number): Promise<boolean> {
        switch (index) {
            case STEP_BUSINESS:
                // One PUT carrying the business fields *and* the licence URL.
                return this._save(this._businessStep());

            case STEP_TAX: {
                const tax = this._taxStep();
                // Optional and unverifiable: a restaurant that leaves it blank
                // should not be blocked by a pointless write (spec Decision 2).
                if (!tax || this._isUntouchedAndEmpty(tax)) {
                    return true;
                }
                return this._save(tax);
            }

            case STEP_ADDRESS: {
                const addressStep = this._addressStep();
                if (!addressStep) {
                    return true;
                }
                // Only save when the add form is open; otherwise advancing just
                // requires that an address already exists.
                if (addressStep.formOpen()) {
                    return this._save(addressStep);
                }
                return addressStep.addresses().length > 0;
            }

            default:
                return true;
        }
    }

    private async _save(step: OnboardingStep | undefined): Promise<boolean> {
        return step ? step.save() : true;
    }

    private _isUntouchedAndEmpty(step: TaxProfileFormComponent): boolean {
        if (step.form.dirty) {
            return false;
        }
        return Object.values(step.form.getRawValue()).every(
            (value) => (value ?? '').toString().trim() === ''
        );
    }

    /** First step whose required items are not all done, else the review step. */
    private _firstOutstandingStep(): number {
        const states = this._completion.states();
        // `tax` is skipped: it has no state that can be outstanding, so
        // resuming must never stop on it.
        const index = STEP_SECTIONS.findIndex((sections) =>
            sections.some(
                (section) =>
                    section !== 'tax' && states[section] === 'outstanding'
            )
        );
        return index >= 0 ? index : STEP_REVIEW;
    }

    private _goTo(index: number): void {
        this.stepIndex.set(Math.min(STEP_REVIEW, Math.max(0, index)));
    }
}
