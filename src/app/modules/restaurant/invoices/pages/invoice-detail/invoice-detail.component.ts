import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { openInvoiceSheet } from '../../invoice-sheet/open-invoice-sheet';

/**
 * `/invoices/:invoiceId` — the deep link into one invoice.
 *
 * The invoice itself is a dialog now (it is a document to glance at, not a
 * place to be), so this route exists only to honour a bookmark: it lands on the
 * invoice list and opens the sheet over it, and closing the sheet leaves the
 * reader in the list rather than on a dead page.
 */
@Component({
    selector: 'restaurant-invoice-detail',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: '',
})
export class InvoiceDetailComponent {
    constructor() {
        const route = inject(ActivatedRoute);
        const router = inject(Router);
        const dialog = inject(MatDialog);
        const invoiceId = route.snapshot.paramMap.get('invoiceId') ?? '';

        void router.navigateByUrl('/profile/invoices').then(() => {
            if (invoiceId) {
                openInvoiceSheet(dialog, invoiceId);
            }
        });
    }
}
