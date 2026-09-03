import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { AssistantNudgeComponent } from './assistant-nudge.component';
import { AssistantService } from './assistant.service';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

/**
 * The greeting is the assistant speaking first, so what matters is *when* it is
 * allowed to: the four conditions that let it appear, and the one rule that
 * keeps it from appearing twice. Every one of those is a promise to a buyer who
 * did not ask to be interrupted.
 */
describe('AssistantNudgeComponent', () => {
    let market: ReturnType<typeof signal<{ id: string; name: string } | null>>;
    let role: string;
    let approved: boolean;

    function createComponent(): {
        component: AssistantNudgeComponent;
        assistant: AssistantService;
    } {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [AssistantNudgeComponent],
            providers: [
                provideTransloco({
                    config: { availableLangs: ['vi'], defaultLang: 'vi' },
                    loader: StubTranslocoLoader,
                }),
                {
                    provide: PermissionsService,
                    useValue: {
                        hasRole: (r: string) => r === role,
                        isApproved: () => approved,
                    },
                },
                {
                    provide: MarketSelectionService,
                    useValue: { selected: market },
                },
            ],
        });
        const fixture = TestBed.createComponent(AssistantNudgeComponent);
        return {
            component: fixture.componentInstance,
            assistant: TestBed.inject(AssistantService),
        };
    }

    beforeEach(() => {
        market = signal<{ id: string; name: string } | null>({
            id: 'mk-1',
            name: 'Chợ Bình Điền',
        });
        role = 'restaurant';
        approved = true;
    });

    it('greets an approved restaurant that has picked a chợ', () => {
        const { component } = createComponent();
        expect(component.visible()).toBe(true);
        expect(component.market()).toBe('Chợ Bình Điền');
    });

    it('stays away until a chợ is picked — it shops one market', () => {
        market.set(null);
        const { component } = createComponent();
        expect(component.visible()).toBe(false);
    });

    it('stays away from anyone who cannot use the assistant', () => {
        role = 'admin';
        expect(createComponent().component.visible()).toBe(false);

        role = 'restaurant';
        approved = false;
        expect(createComponent().component.visible()).toBe(false);
    });

    it('does not invite someone into a conversation they are already in', () => {
        const { component, assistant } = createComponent();
        assistant.opened.set(true);
        expect(component.visible()).toBe(false);
    });

    it('is offered once: opening the chat spends it', () => {
        const { component, assistant } = createComponent();
        component.open();

        expect(assistant.opened()).toBe(true);
        assistant.opened.set(false);
        // Even with the chat closed again, the offer has been answered.
        expect(component.visible()).toBe(false);
    });

    it('is offered once: dismissing spends it without opening the chat', () => {
        const { component, assistant } = createComponent();
        component.dismiss();

        expect(assistant.opened()).toBe(false);
        expect(component.visible()).toBe(false);
    });

    it('hands a starter over as the words the buyer pressed', () => {
        const { component, assistant } = createComponent();
        component.start('assistant.nudge.starter.browse');

        expect(assistant.opened()).toBe(true);
        // Translation is stubbed empty, so the key comes back as itself — the
        // point is that a *phrase* is handed over and taken exactly once.
        expect(assistant.takeStarter()).toBe('assistant.nudge.starter.browse');
        expect(assistant.takeStarter()).toBeNull();
    });
});
