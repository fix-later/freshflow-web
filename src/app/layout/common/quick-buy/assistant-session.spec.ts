import { TestBed } from '@angular/core/testing';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { AssistantService } from './assistant.service';

const STORAGE_KEY = 'freshflow.assistant.session';
const TTL_MS = 30 * 60 * 1000;

/**
 * A reload used to lose the conversation entirely, though the server had kept
 * it all along — the handle was minted fresh in memory every load. What matters
 * now is that the two sides forget together: the screen must never show a
 * history the assistant can no longer remember, and nothing may be left waiting
 * for the next person at a shared browser.
 */
describe('AssistantService — surviving a reload', () => {
    function createService(): AssistantService {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: MarketSelectionService,
                    useValue: { selectedId: () => 'mk-1' },
                },
            ],
        });
        return TestBed.inject(AssistantService);
    }

    beforeEach(() => sessionStorage.clear());
    afterEach(() => sessionStorage.clear());

    it('starts fresh when nothing was stored', () => {
        const service = createService();
        expect(service.restoredMessages()).toEqual([]);
        expect(service.restoredDraftOrderId()).toBeNull();
    });

    it('comes back to the same conversation, handle and all', () => {
        const first = createService();
        const sessionId = first.sessionId;
        first.persist(
            [
                { role: 'user', text: '20kg cải ngọt' },
                { role: 'assistant', text: 'Đã gom giúp bạn.' },
            ],
            'draft-1'
        );

        // A reload: same tab, same storage, a new instance of everything.
        const second = createService();

        expect(second.sessionId).toBe(sessionId);
        expect(second.restoredMessages().map((m) => m.text)).toEqual([
            '20kg cải ngọt',
            'Đã gom giúp bạn.',
        ]);
        expect(second.restoredDraftOrderId()).toBe('draft-1');
    });

    it('forgets once the server would have — same 30-minute clock', () => {
        const first = createService();
        first.persist([{ role: 'user', text: 'chào' }], null);

        // Age the stored copy past the server's conversation TTL.
        const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!);
        stored.at = Date.now() - TTL_MS - 1000;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

        const second = createService();
        expect(second.restoredMessages()).toEqual([]);
        expect(second.sessionId).not.toBe(first.sessionId);
        // And the stale copy is not left lying around.
        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('keeps nothing when the conversation is emptied', () => {
        const service = createService();
        service.persist([{ role: 'user', text: 'chào' }], null);
        expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();

        service.persist([], null);
        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('drops the conversation on start over, and mints a new handle', () => {
        const service = createService();
        service.persist([{ role: 'user', text: 'chào' }], 'draft-1');
        const before = service.sessionId;

        service.reset();

        expect(service.sessionId).not.toBe(before);
        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('leaves nothing behind for the next person at the browser', () => {
        const service = createService();
        service.persist([{ role: 'user', text: 'công nợ của tôi' }], null);

        service.forget();

        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(createService().restoredMessages()).toEqual([]);
    });

    it('treats a corrupted copy as no conversation at all', () => {
        sessionStorage.setItem(STORAGE_KEY, '{not json');
        expect(createService().restoredMessages()).toEqual([]);

        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ sessionId: 's', at: Date.now() })
        );
        expect(createService().restoredMessages()).toEqual([]);
    });
});
