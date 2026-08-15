import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { MarketStaffPanelComponent } from './market-staff-panel.component';

/** Minimal Transloco loader — no label in this file is under test. */
class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

function createPanel(): MarketStaffPanelComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        imports: [MarketStaffPanelComponent],
        providers: [
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
        ],
    });
    // `componentInstance` without `detectChanges`: the constructor is all this
    // needs, and running `ngOnInit` would send the panel's real loads.
    return TestBed.createComponent(MarketStaffPanelComponent).componentInstance;
}

/**
 * `needsHub` decides whether the dialog asks which hub the person joins, and
 * `canSave` waves an empty hub through whenever it answers false. Stuck false,
 * the assignment goes out as `/api/v1/hubs//driver-assignments` — a URL that
 * matches no route and 404s with no body, so it reaches the admin as a generic
 * failure rather than as the missing hub it is.
 *
 * It answered false forever once, because it was a `computed()` reading
 * `addForm.controls.role.value`: a FormControl is not reactive state, so the
 * computed took no dependency and never recomputed. These assert the *change*,
 * which is the part that was broken — the initial value was always right.
 */
describe('MarketStaffPanelComponent — needsHub tracks the picked role', () => {
    it('is false for the market-agent role it opens on', () => {
        expect(createPanel().needsHub()).toBe(false);
    });

    it('turns true when the role changes to a hub-scoped one', () => {
        const panel = createPanel();

        // Read *before* the change, which is what the template does when the
        // dialog first renders. A dependency-less computed caches on its first
        // evaluation, so reading only afterwards would see the fresh value and
        // pass against the bug.
        expect(panel.needsHub()).toBe(false);

        panel.addForm.controls.role.setValue('driver');
        expect(panel.needsHub()).toBe(true);

        panel.addForm.controls.role.setValue('hub_staff');
        expect(panel.needsHub()).toBe(true);
    });

    it('turns back off when the role leaves the hub-scoped set', () => {
        const panel = createPanel();

        panel.addForm.controls.role.setValue('driver');
        expect(panel.needsHub()).toBe(true);

        panel.addForm.controls.role.setValue('market_agent');
        expect(panel.needsHub()).toBe(false);
    });

    it('follows the reset that reopening the dialog performs', () => {
        const panel = createPanel();
        panel.addForm.controls.role.setValue('driver');
        expect(panel.needsHub()).toBe(true);

        panel.addForm.reset({ role: 'market_agent', hubId: '' });

        expect(panel.needsHub()).toBe(false);
    });

    it('refuses to save a hub-scoped role with no hub picked', () => {
        const panel = createPanel();
        // Same ordering rule: settle `needsHub` on the opening role first.
        expect(panel.needsHub()).toBe(false);

        panel.addForm.controls.role.setValue('driver');
        panel.togglePick('driver-1', true);

        // The guard that the stuck `needsHub` was disabling — this is what let
        // an empty hub id reach the URL.
        expect(panel.canSave()).toBe(false);

        panel.addForm.controls.hubId.setValue('hub-1');
        expect(panel.canSave()).toBe(true);
    });
});
