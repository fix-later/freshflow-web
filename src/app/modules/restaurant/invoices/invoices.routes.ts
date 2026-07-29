import { Routes } from '@angular/router';
import { roleGuard } from 'app/core/auth/guards/role.guard';
import { InvoiceDetailComponent } from './pages/invoice-detail/invoice-detail.component';

/**
 * The list lives as the "Hóa đơn" tab on `/profile` — only the detail page
 * is a real route here, so a bare `/invoices` (bookmark, typo) lands
 * somewhere useful instead of a blank outlet.
 */
export default [
    { path: '', redirectTo: '/profile?tab=invoices', pathMatch: 'full' },
    {
        path: ':invoiceId',
        canActivate: [roleGuard(['restaurant'])],
        component: InvoiceDetailComponent,
    },
] as Routes;
