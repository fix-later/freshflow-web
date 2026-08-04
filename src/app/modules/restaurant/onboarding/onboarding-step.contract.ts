/**
 * What the onboarding wizard needs from the form components it embeds.
 *
 * The wizard drives three components it does not own —
 * `BusinessProfileFormComponent`, `TaxProfileFormComponent` and
 * `DeliveryAddressesComponent`. Rather than teaching each of them about the
 * wizard, they satisfy this structural interface, which the wizard reaches
 * through `viewChild()`.
 *
 * All three already exposed a public `form` and `save()`; the only thing added
 * for the wizard was letting `save()` report success, so the caller can decide
 * whether to advance (FR-024). The components still surface their own failures
 * to the user.
 *
 * See `specs/003-restaurant-onboarding-wizard/contracts/onboarding-ui-contract.md` § 1.
 */
export interface OnboardingStep {
    /** The step's reactive form, used to gate advancing on validity. */
    readonly form: {
        readonly invalid: boolean;
        markAllAsTouched(): void;
    };

    /**
     * Persist this step. Resolves `true` when the write succeeded, `false` when
     * it was rejected or the form was invalid.
     */
    save(): Promise<boolean>;
}
