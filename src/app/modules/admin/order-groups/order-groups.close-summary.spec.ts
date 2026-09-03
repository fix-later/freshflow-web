import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import {
    AdminMarketSessionProductSummary,
    AdminMarketSessionTracking,
} from '../admin.types';
import { OrderGroupsComponent } from './order-groups.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

function product(
    name: string,
    unit: string,
    quantity: number
): AdminMarketSessionProductSummary {
    return {
        marketProductId: name,
        productName: name,
        unitAbbreviation: unit,
        totalQuantity: quantity,
        orderCount: 1,
    };
}

function tracking(
    products: AdminMarketSessionProductSummary[]
): AdminMarketSessionTracking {
    return { products } as AdminMarketSessionTracking;
}

/** The component only for the close dialog's figures; nothing is fetched. */
function createComponent(): OrderGroupsComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        imports: [OrderGroupsComponent],
        providers: [
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
            {
                provide: AdminService,
                useValue: {
                    getOrderGroups: () =>
                        Promise.resolve({ groups: [], totalCount: 0 }),
                    getMarkets: () => Promise.resolve([]),
                    getAgentOptions: () => Promise.resolve([]),
                    getSettledOrder: () => Promise.resolve(null),
                } as unknown as AdminService,
            },
            { provide: Router, useValue: { navigate: () => undefined } },
            {
                provide: ActivatedRoute,
                useValue: {
                    snapshot: {
                        data: { view: 'history' },
                        paramMap: { get: () => null },
                        queryParamMap: { get: () => null },
                    },
                },
            },
        ],
    });
    return TestBed.createComponent(OrderGroupsComponent).componentInstance;
}

/**
 * Closing a phiên chợ is irreversible, so the confirmation has to say what is
 * being locked in. A single quantity across every product cannot: kilos of rau,
 * thùng of nước mắm and bó of hành do not add up to anything an operator can
 * picture, and the figure reads as authoritative anyway.
 */
describe('OrderGroupsComponent — what closing a session locks in', () => {
    it('totals the quantity within each unit, never across units', () => {
        const component = createComponent();
        component.closingMarketSessionTracking.set(
            tracking([
                product('Cải ngọt', 'kg', 45),
                product('Cà chua bi', 'kg', 30),
                product('Nước mắm', 'thùng', 8),
                product('Hành lá', 'bó', 60),
            ])
        );

        expect(component.closingSessionQuantityTotals()).toEqual([
            { unit: 'kg', total: 75 },
            { unit: 'thùng', total: 8 },
            { unit: 'bó', total: 60 },
        ]);
    });

    // A product with no unit configured still has to be counted — it is stock
    // somebody has to buy — so it groups under the empty unit the dialog labels.
    it('keeps products with no unit of their own', () => {
        const component = createComponent();
        component.closingMarketSessionTracking.set(
            tracking([product('Chưa gán ĐVT', '', 12)])
        );

        expect(component.closingSessionQuantityTotals()).toEqual([
            { unit: '', total: 12 },
        ]);
    });

    it('has nothing to show before the summary arrives', () => {
        const component = createComponent();

        expect(component.closingSessionQuantityTotals()).toEqual([]);
    });
});
