import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { CreditComponent } from './credit.component';
import { RestaurantCreditService } from './restaurant-credit.service';
import { CreditStatement } from './restaurant-credit.types';

/** The loader is never reached — {@link LABELS} is set on the service directly. */
class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

/** The statement labels this file asserts on, and nothing else. */
const LABELS: Record<string, string> = {
    'restaurantCredit.statements.openingBalance': 'Số dư đầu kỳ',
    'restaurantCredit.statements.charges': 'Ghi nợ trong kỳ',
    'restaurantCredit.statements.payments': 'Đã thanh toán',
    'restaurantCredit.statements.refunds': 'Hoàn tiền',
    'restaurantCredit.statements.closingBalance': 'Số dư cuối kỳ',
    'restaurantCredit.statements.dueDate': 'Hạn thanh toán',
};

/** Nothing here reaches the network: `ngOnInit` is never run. */
const serviceStub: Partial<RestaurantCreditService> = {};

function build(detail: CreditStatement | null): CreditComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        imports: [CreditComponent],
        providers: [
            provideTransloco({
                config: { availableLangs: ['vi'], defaultLang: 'vi' },
                loader: StubTranslocoLoader,
            }),
            {
                provide: RestaurantCreditService,
                useValue: serviceStub as RestaurantCreditService,
            },
        ],
    });
    // Set on the service rather than served by the loader: the loader resolves
    // a microtask later, and these assertions read the labels synchronously.
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation(LABELS, 'vi');
    transloco.setActiveLang('vi');
    const component =
        TestBed.createComponent(CreditComponent).componentInstance;
    component.statementDetail.set(detail);
    return component;
}

const statement = (patch: Partial<CreditStatement> = {}): CreditStatement => ({
    id: 'st-1',
    year: 2026,
    month: 7,
    openingBalance: 1_000_000,
    totalCharges: 4_500_000,
    totalPayments: 3_000_000,
    closingBalance: 2_500_000,
    ...patch,
});

/**
 * The breakdown used to be built by reflecting over the response: every scalar
 * the endpoint returned, labelled by its own JSON field name humanised into
 * English. A Vietnamese restaurant read "Total charges" and its own
 * `restaurantId`, and any field the backend added appeared unannounced.
 */
describe('Restaurant credit — statement breakdown', () => {
    it('names the figures a month is settled on, translated', async () => {
        const component = build(statement());

        expect(component.statementEntries().map((row) => row.label)).toEqual([
            'Số dư đầu kỳ',
            'Ghi nợ trong kỳ',
            'Đã thanh toán',
            'Số dư cuối kỳ',
        ]);
    });

    it('does not print identifiers or unknown fields from the response', () => {
        const component = build(
            statement({
                restaurantId: 'r-1',
                generatedBy: 'admin@freshflow.vn',
                someFutureField: 42,
            })
        );

        const printed = component
            .statementEntries()
            .map((row) => row.value)
            .join(' ');
        expect(printed).not.toContain('r-1');
        expect(printed).not.toContain('admin@freshflow.vn');
        expect(printed).not.toContain('42');
    });

    /** An absent refund line is not a refund of nothing. */
    it('drops a figure the statement does not carry', () => {
        const labels = build(statement())
            .statementEntries()
            .map((row) => row.label);
        expect(labels).not.toContain('Hoàn tiền');

        const withRefund = build(statement({ totalRefunds: 250_000 }))
            .statementEntries()
            .map((row) => row.label);
        expect(withRefund).toContain('Hoàn tiền');
    });

    it('shows nothing at all until the detail has been read', () => {
        expect(build(null).statementEntries()).toEqual([]);
    });
});
