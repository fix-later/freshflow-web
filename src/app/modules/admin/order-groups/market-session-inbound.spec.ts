import { CrudRow } from '../shared/resource-crud.types';
import { findMarketSessionInbound } from './order-groups.component';

describe('findMarketSessionInbound', () => {
    it('matches the inbound created from the tracked procurement batch', () => {
        const rows: CrudRow[] = [
            {
                id: 'inbound-1',
                deliveryScheduleId: 'BATCH-1',
                status: 'ARRIVED_AT_HUB',
            },
        ];

        expect(findMarketSessionInbound(rows, 'batch-1')).toBe(rows[0]);
    });

    it('does not surface an inbound from another batch', () => {
        const rows: CrudRow[] = [
            {
                id: 'inbound-1',
                deliveryScheduleId: 'batch-2',
                status: 'PENDING',
            },
        ];

        expect(findMarketSessionInbound(rows, 'batch-1')).toBeNull();
    });
});
