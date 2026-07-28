import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { AdminOrderGroupRow } from '../admin.types';
import { OrderGroupDetailComponent } from './order-group-detail.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

const sampleBatch: AdminOrderGroupRow = {
    id: 'batch-1',
    batchDate: '2026-07-23',
    marketId: 'market-1',
    status: 'HandedOff',
    hubId: 'hub-1',
    assignedAgentUserId: 'agent-1',
    totalItemCount: 1,
    items: [{ productNameSnapshot: 'Bơ', totalQuantity: 2 }],
    members: [{ orderId: 'order-abc', status: 'AtHub' }],
    exceptions: [{ id: 'ex-1', type: 'PriceDiscrepancy', reportedQuantity: 2 }],
} as AdminOrderGroupRow;

const adminStub: Partial<AdminService> = {
    getOrderGroup: () => Promise.resolve(sampleBatch),
    getMarkets: () => Promise.resolve([]),
    getHubs: () => Promise.resolve([]),
    getAgentOptions: () => Promise.resolve([]),
    getOrder: () => Promise.resolve(null),
    getUsers: () => Promise.resolve({ users: [], totalCount: 0 }),
};

describe('OrderGroupDetailComponent', () => {
    it('renders batch summary on the info tab', async () => {
        TestBed.configureTestingModule({
            imports: [OrderGroupDetailComponent],
            providers: [
                provideTransloco({
                    config: { availableLangs: ['en'], defaultLang: 'en' },
                    loader: StubTranslocoLoader,
                }),
                { provide: AdminService, useValue: adminStub },
                { provide: Router, useValue: { navigate: () => undefined } },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: { paramMap: { get: () => 'batch-1' } },
                    },
                },
            ],
        });

        const fixture = TestBed.createComponent(OrderGroupDetailComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        const text = root.textContent ?? '';
        expect(text).toContain('batch-1');
        expect(text).toContain('market-1');
        expect(text).toContain('hub-1');
        expect(text).toContain('agent-1');
    });
});
