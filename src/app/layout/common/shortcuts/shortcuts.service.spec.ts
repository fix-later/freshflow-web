import { TestBed } from '@angular/core/testing';
import { ShortcutsService } from './shortcuts.service';
import { Shortcut } from './shortcuts.types';

const STORAGE_KEY = 'freshflow.shortcuts';

/**
 * Shortcuts are a per-browser preference with no backend behind them, so the
 * storage round-trip *is* the contract: seed on first run, survive a reload,
 * and never blank the panel on corrupt data.
 */
describe('ShortcutsService', () => {
    /** The service seeds in its constructor — build it after arranging storage. */
    const make = (): ShortcutsService => {
        TestBed.resetTestingModule();
        return TestBed.inject(ShortcutsService);
    };

    const current = (service: ShortcutsService): Shortcut[] => {
        let shortcuts: Shortcut[] = [];
        service.shortcuts$.subscribe((value) => (shortcuts = value));
        return shortcuts;
    };

    beforeEach(() => localStorage.removeItem(STORAGE_KEY));
    afterEach(() => localStorage.removeItem(STORAGE_KEY));

    it('seeds the admin defaults on first run', () => {
        const shortcuts = current(make());

        expect(shortcuts.length).toBeGreaterThan(0);
        expect(shortcuts.map((s) => s.link)).toContain('/admin/order-groups');
        // Every seeded entry must route internally, not reload the app.
        expect(shortcuts.every((s) => s.useRouter)).toBe(true);
    });

    it('persists a created shortcut across a reload', () => {
        const service = make();
        service
            .create({
                id: null as unknown as string,
                label: 'Vùng giao hàng',
                icon: 'heroicons_outline:map',
                link: '/admin/delivery-zones',
                useRouter: true,
            })
            .subscribe();

        // A fresh instance reads storage the way a page reload would.
        const reloaded = current(make());
        expect(reloaded.map((s) => s.label)).toContain('Vùng giao hàng');
    });

    it('assigns an id on create so later edits can target it', () => {
        const service = make();
        let created: Shortcut | undefined;
        service
            .create({
                id: null as unknown as string,
                label: 'Hub',
                icon: 'heroicons_outline:map',
                link: '/admin/hubs',
                useRouter: true,
            })
            .subscribe((value) => (created = value));

        expect(created?.id).toBeTruthy();
    });

    it('updates in place without reordering the list', () => {
        const service = make();
        const before = current(service);
        const target = before[1];

        service.update(target.id, { ...target, label: 'Đổi tên' }).subscribe();

        const after = current(service);
        expect(after.length).toBe(before.length);
        expect(after[1].id).toBe(target.id);
        expect(after[1].label).toBe('Đổi tên');
    });

    it('deletes only the targeted shortcut and persists it', () => {
        const service = make();
        const before = current(service);
        const removed = before[0];

        service.delete(removed.id).subscribe();

        const reloaded = current(make());
        expect(reloaded.length).toBe(before.length - 1);
        expect(reloaded.map((s) => s.id)).not.toContain(removed.id);
    });

    it('falls back to defaults when stored data is corrupt', () => {
        localStorage.setItem(STORAGE_KEY, '{ not an array');

        expect(current(make()).length).toBeGreaterThan(0);
    });

    it('falls back to defaults when stored data is valid JSON but not a list', () => {
        localStorage.setItem(STORAGE_KEY, '{"label":"nope"}');

        expect(current(make()).length).toBeGreaterThan(0);
    });
});
