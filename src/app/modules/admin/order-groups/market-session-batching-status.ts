import { AdminMarketSession } from '../admin.types';

/**
 * BE does not persist a second enum for batching. Its authoritative state is
 * derived from the session lifecycle and `batchingCompletedAt`:
 *
 * - draft/open: batching cannot start yet;
 * - closed without a completion timestamp: the close-time attempt failed or
 *   has not run yet, so the hosted job (or an Admin retry) may process it;
 * - closed with a completion timestamp: batching has finished, including the
 *   valid "no eligible orders" outcome.
 */
export type MarketSessionBatchingStatus =
    | 'not_started'
    | 'pending'
    | 'completed';

export function marketSessionBatchingStatus(
    session: Pick<AdminMarketSession, 'status' | 'batchingCompletedAt'>
): MarketSessionBatchingStatus {
    if (session.status !== 'closed') {
        return 'not_started';
    }
    return session.batchingCompletedAt ? 'completed' : 'pending';
}

export function canRetryMarketSessionBatching(
    session: Pick<AdminMarketSession, 'status' | 'batchingCompletedAt'>
): boolean {
    return marketSessionBatchingStatus(session) === 'pending';
}
