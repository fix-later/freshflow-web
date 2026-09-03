import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTransloco } from '@jsverse/transloco';
import { CreditComponent } from './credit.component';
import { RestaurantCreditService } from './restaurant-credit.service';
import { CreditStatement } from './restaurant-credit.types';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

/** Nothing here reaches the network: `ngOnInit` is never run. */
const serviceStub: Partial<RestaurantCreditService> = {};

function build(): CreditComponent {
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
            { provide: MatDialog, useValue: { open: () => undefined } },
        ],
    });
    return TestBed.createComponent(CreditComponent).componentInstance;
}

const statement = (patch: Partial<CreditStatement>): CreditStatement =>
    ({ id: 'st-1', ...patch }) as CreditStatement;

/**
 * A statement covers a date range — `periodStart`…`periodEnd`, closed in
 * Asia/Ho_Chi_Minh. The row used to print `month`/`year`, fields no statement
 * has ever carried, so every row in the list read as a bare "/".
 */
describe('CreditComponent — which month a statement covers', () => {
    it('reads the period from the dates the statement carries', () => {
        const component = build();

        const label = component.statementPeriod(
            statement({
                periodStart: '2026-08-01T00:00:00Z',
                periodEnd: '2026-08-31T23:59:59Z',
            })
        );

        expect(label).toContain('2026');
        expect(label).toContain('—');
    });

    // A statement that somehow covers one day should not read "x — x".
    it('says a single day once', () => {
        const component = build();

        const label = component.statementPeriod(
            statement({
                periodStart: '2026-08-01T00:00:00Z',
                periodEnd: '2026-08-01T00:00:00Z',
            })
        );

        expect(label).not.toContain('—');
    });

    // Rather than an empty row: an old statement read through a shape that has
    // no period at all still has the day it was closed.
    it('falls back to the day it was generated', () => {
        const component = build();

        const label = component.statementPeriod(
            statement({ generatedAt: '2026-09-01T01:00:00Z' })
        );

        expect(label).not.toBe('—');
    });

    it('offers to close the month that has just ended', () => {
        const component = build();
        const now = new Date();
        const expected =
            now.getMonth() === 0
                ? { year: now.getFullYear() - 1, month: 12 }
                : { year: now.getFullYear(), month: now.getMonth() };

        expect(component.generateForm.getRawValue()).toEqual(expected);
    });
});
