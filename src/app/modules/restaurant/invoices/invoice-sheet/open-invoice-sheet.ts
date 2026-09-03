import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { InvoiceRow } from '../restaurant-invoices.types';
import {
    InvoiceSheetComponent,
    InvoiceSheetData,
} from './invoice-sheet.component';

/**
 * Opens one invoice over whatever the reader is looking at — the invoice list,
 * an order in the history, the order's own page.
 *
 * One function rather than each caller repeating the dialog config: the sheet
 * is a document, and a document that is wider in one place than another reads
 * as two different things.
 */
export function openInvoiceSheet(
    dialog: MatDialog,
    invoiceId: string,
    row?: InvoiceRow | null
): MatDialogRef<InvoiceSheetComponent> {
    return dialog.open<InvoiceSheetComponent, InvoiceSheetData>(
        InvoiceSheetComponent,
        {
            data: { invoiceId, row },
            panelClass: 'invoice-sheet-dialog',
            width: '56rem',
            maxWidth: '96vw',
            autoFocus: false,
        }
    );
}
