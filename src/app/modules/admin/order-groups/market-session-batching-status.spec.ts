import {
    canRetryMarketSessionBatching,
    marketSessionBatchingStatus,
} from './market-session-batching-status';

describe('market session batching state', () => {
    it('does not start before the session is closed', () => {
        expect(
            marketSessionBatchingStatus({
                status: 'draft',
                batchingCompletedAt: null,
            })
        ).toBe('not_started');
        expect(
            marketSessionBatchingStatus({
                status: 'open',
                batchingCompletedAt: null,
            })
        ).toBe('not_started');
    });

    it('marks a closed session without a timestamp as pending and retryable', () => {
        const session = {
            status: 'closed' as const,
            batchingCompletedAt: null,
        };

        expect(marketSessionBatchingStatus(session)).toBe('pending');
        expect(canRetryMarketSessionBatching(session)).toBeTrue();
    });

    it('treats the completion timestamp as authoritative even without a batch', () => {
        const session = {
            status: 'closed' as const,
            batchingCompletedAt: '2026-08-14T03:00:00Z',
        };

        expect(marketSessionBatchingStatus(session)).toBe('completed');
        expect(canRetryMarketSessionBatching(session)).toBeFalse();
    });
});
