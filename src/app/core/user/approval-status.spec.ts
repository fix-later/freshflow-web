import { toApprovalStatus } from './user.types';

/**
 * `GET /restaurants/me/approval-status` speaks the lifecycle vocabulary
 * `pending | active | suspended` — verified live: an approved restaurant
 * answers `"active"`, never `"approved"`. The client type is
 * `pending | approved | rejected`, and without a mapping every approved
 * restaurant fell through to the `pending` fallback: the "chờ duyệt" banner
 * stayed up and ordering stayed blocked no matter how many times an admin
 * approved the account.
 */
describe('toApprovalStatus', () => {
    it('treats the API "active" as approved', () => {
        expect(toApprovalStatus('active')).toBe('approved');
        expect(toApprovalStatus('Active')).toBe('approved');
        expect(toApprovalStatus(' ACTIVE ')).toBe('approved');
    });

    it('treats the API "suspended" as blocked, not waiting', () => {
        expect(toApprovalStatus('suspended')).toBe('rejected');
    });

    it('keeps pending pending', () => {
        expect(toApprovalStatus('pending')).toBe('pending');
    });

    it('still accepts the client vocabulary', () => {
        expect(toApprovalStatus('approved')).toBe('approved');
        expect(toApprovalStatus('rejected')).toBe('rejected');
    });

    it('falls back to pending for anything unrecognised', () => {
        expect(toApprovalStatus(undefined)).toBe('pending');
        expect(toApprovalStatus(null)).toBe('pending');
        expect(toApprovalStatus('')).toBe('pending');
        expect(toApprovalStatus('something-new')).toBe('pending');
    });
});
