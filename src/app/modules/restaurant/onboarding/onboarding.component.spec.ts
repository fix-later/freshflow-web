import { signal, Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SetupCompletionService } from '../setup/setup-completion.service';
import { SetupItemStates } from '../setup/setup.types';
import { OnboardingStep } from './onboarding-step.contract';
import { OnboardingComponent } from './onboarding.component';

/**
 * The component's view queries, which these tests replace with stubs. Rendering
 * the real stepper would mount three API-backed forms and — because the steps
 * use `matStepContent` — leave the inactive ones unrendered anyway, so the
 * decision logic is exercised directly instead.
 */
interface WizardQueries {
    _businessStep: Signal<OnboardingStep | undefined>;
    _taxStep: Signal<OnboardingStep | undefined>;
    _addressStep: Signal<AddressStepStub | undefined>;
}

interface AddressStepStub extends OnboardingStep {
    formOpen(): boolean;
    addresses(): readonly unknown[];
}

function stepStub(saveResult: boolean): OnboardingStep & {
    save: jasmine.Spy<() => Promise<boolean>>;
} {
    return {
        form: { invalid: false, markAllAsTouched: () => undefined },
        save: jasmine
            .createSpy('save')
            .and.resolveTo(saveResult) as jasmine.Spy<() => Promise<boolean>>,
    };
}

function taxStub(options: { dirty: boolean; values: Record<string, unknown> }) {
    return {
        form: {
            invalid: false,
            dirty: options.dirty,
            markAllAsTouched: () => undefined,
            getRawValue: () => options.values,
        },
        save: jasmine.createSpy('save').and.resolveTo(true),
    };
}

function addressStub(options: {
    formOpen: boolean;
    count: number;
    saveResult?: boolean;
}): AddressStepStub {
    return {
        form: { invalid: false, markAllAsTouched: () => undefined },
        save: jasmine
            .createSpy('save')
            .and.resolveTo(options.saveResult ?? true),
        formOpen: () => options.formOpen,
        addresses: () => new Array(options.count).fill({}),
    };
}

const ALL_OUTSTANDING: SetupItemStates = {
    business: 'outstanding',
    license: 'outstanding',
    address: 'outstanding',
};

describe('OnboardingComponent', () => {
    let component: OnboardingComponent;
    let queries: WizardQueries;
    let states: ReturnType<typeof signal<SetupItemStates>>;
    let dismiss: jasmine.Spy;
    let navigateByUrl: jasmine.Spy;

    function build(): void {
        states = signal<SetupItemStates>(ALL_OUTSTANDING);
        dismiss = jasmine.createSpy('dismiss');
        navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);

        TestBed.configureTestingModule({
            providers: [
                {
                    provide: SetupCompletionService,
                    useValue: {
                        states: states.asReadonly(),
                        progress: signal({
                            completed: 0,
                            total: 3,
                            outstanding: ['business', 'license', 'address'],
                            isComplete: false,
                        }).asReadonly(),
                        load: () => Promise.resolve(),
                        invalidate: () => undefined,
                        dismiss,
                    },
                },
                { provide: Router, useValue: { navigateByUrl } },
            ],
        });

        component = TestBed.runInInjectionContext(
            () => new OnboardingComponent()
        );
        queries = component as unknown as WizardQueries;
    }

    beforeEach(() => build());

    describe('continue() gates advancing on the save landing', () => {
        it('does not advance when the step save is rejected (FR-024)', async () => {
            const business = stepStub(false);
            queries._businessStep = signal(business).asReadonly();
            component.stepIndex.set(0);

            await component.continue();

            expect(business.save).toHaveBeenCalled();
            expect(component.stepIndex())
                .withContext('a failed save must leave the step outstanding')
                .toBe(0);
        });

        it('advances when the step save succeeds (FR-009)', async () => {
            const business = stepStub(true);
            queries._businessStep = signal(business).asReadonly();
            component.stepIndex.set(0);

            await component.continue();

            expect(business.save).toHaveBeenCalled();
            expect(component.stepIndex()).toBe(1);
        });

        it('clears the advancing flag after a rejected save', async () => {
            queries._businessStep = signal(stepStub(false)).asReadonly();
            component.stepIndex.set(0);

            await component.continue();

            expect(component.advancing()).toBeFalse();
        });

        it('ignores a second continue while one is in flight', async () => {
            const business = stepStub(true);
            queries._businessStep = signal(business).asReadonly();
            component.stepIndex.set(0);

            await Promise.all([component.continue(), component.continue()]);

            expect(business.save).toHaveBeenCalledTimes(1);
        });
    });

    describe('the tax step is optional', () => {
        it('advances without saving when untouched and empty (Decision 2)', async () => {
            const tax = taxStub({
                dirty: false,
                values: { taxCode: null, legalName: '', address: '  ' },
            });
            queries._taxStep = signal(
                tax as unknown as OnboardingStep
            ).asReadonly();
            component.stepIndex.set(1);

            await component.continue();

            expect(tax.save).not.toHaveBeenCalled();
            expect(component.stepIndex()).toBe(2);
        });

        it('saves when the restaurant actually entered something', async () => {
            const tax = taxStub({
                dirty: true,
                values: { taxCode: '0101234567' },
            });
            queries._taxStep = signal(
                tax as unknown as OnboardingStep
            ).asReadonly();
            component.stepIndex.set(1);

            await component.continue();

            expect(tax.save).toHaveBeenCalled();
            expect(component.stepIndex()).toBe(2);
        });
    });

    describe('the address step gates on an address existing', () => {
        it('advances without saving when one is already saved', async () => {
            const address = addressStub({ formOpen: false, count: 1 });
            queries._addressStep = signal(address).asReadonly();
            component.stepIndex.set(2);

            await component.continue();

            expect(address.save).not.toHaveBeenCalled();
            expect(component.stepIndex()).toBe(3);
        });

        it('does not advance when none is saved and the form is closed', async () => {
            queries._addressStep = signal(
                addressStub({ formOpen: false, count: 0 })
            ).asReadonly();
            component.stepIndex.set(2);

            await component.continue();

            expect(component.stepIndex()).toBe(2);
        });

        it('saves the open form before advancing', async () => {
            const address = addressStub({ formOpen: true, count: 0 });
            queries._addressStep = signal(address).asReadonly();
            component.stepIndex.set(2);

            await component.continue();

            expect(address.save).toHaveBeenCalled();
            expect(component.stepIndex()).toBe(3);
        });

        it('canContinue is false with no address and a closed form', () => {
            queries._addressStep = signal(
                addressStub({ formOpen: false, count: 0 })
            ).asReadonly();
            component.stepIndex.set(2);

            expect(component.canContinue()).toBeFalse();
        });
    });

    describe('skip', () => {
        it('advances without saving and leaves the step outstanding (FR-010)', () => {
            const business = stepStub(true);
            queries._businessStep = signal(business).asReadonly();
            component.stepIndex.set(0);

            component.skip();

            expect(business.save).not.toHaveBeenCalled();
            expect(component.stepIndex()).toBe(1);
        });

        it('does not run past the review step', () => {
            component.stepIndex.set(3);
            component.skip();
            expect(component.stepIndex()).toBe(3);
        });
    });

    describe('resume', () => {
        it('starts on the business step when nothing is done (FR-012)', async () => {
            await component.ngOnInit();
            expect(component.stepIndex()).toBe(0);
        });

        it('skips past the business step once it and the licence are done', async () => {
            states.set({
                business: 'done',
                license: 'done',
                address: 'outstanding',
            });

            await component.ngOnInit();

            expect(component.stepIndex())
                .withContext('the address step, not the optional tax step')
                .toBe(2);
        });

        it('stays on the business step while only the licence is missing', async () => {
            states.set({
                business: 'done',
                license: 'outstanding',
                address: 'done',
            });

            await component.ngOnInit();

            expect(component.stepIndex())
                .withContext('the licence is edited in the business step')
                .toBe(0);
        });

        it('opens on the review step when every required item is done', async () => {
            states.set({
                business: 'done',
                license: 'done',
                address: 'done',
            });

            await component.ngOnInit();

            expect(component.stepIndex()).toBe(3);
        });
    });

    describe('leaving', () => {
        it('records a dismissal and returns to the storefront (FR-003)', () => {
            component.exit();

            expect(dismiss).toHaveBeenCalled();
            expect(navigateByUrl).toHaveBeenCalledWith('/home');
        });

        it('finishing posts nothing — there is no submit endpoint (FR-014)', async () => {
            component.stepIndex.set(3);

            await component.continue();

            expect(navigateByUrl).toHaveBeenCalledWith('/home');
        });
    });

    describe('openSection', () => {
        it('opens the business step for the licence, which shares that form', () => {
            component.stepIndex.set(3);
            component.openSection('license');
            expect(component.stepIndex()).toBe(0);
        });

        it('opens the address step for the address item', () => {
            component.stepIndex.set(3);
            component.openSection('address');
            expect(component.stepIndex()).toBe(2);
        });

        // The tax step has no required item, so it is reachable only as a
        // review section — without this mapping its summary card could not be
        // edited from the review step.
        it('opens the optional tax step for the tax section', () => {
            component.stepIndex.set(3);
            component.openSection('tax');
            expect(component.stepIndex()).toBe(1);
        });
    });
});
