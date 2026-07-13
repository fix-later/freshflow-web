import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    TemplateRef,
    ViewChild,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

/** A restaurant branch (delivery address) selectable from the header. */
export interface Branch {
    id: string;
    name: string;
    lastOrderDate?: string;
}

/**
 * Header branch picker: the "Địa chỉ nhà hàng" button opens a popup listing
 * every branch with search; picking one makes it the active branch shown on
 * the button.
 */
@Component({
    selector: 'branch-picker',
    templateUrl: './branch-picker.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatButtonModule, MatIconModule],
})
export class BranchPickerComponent implements OnDestroy {
    @ViewChild('branchPickerPanel') private _panel: TemplateRef<unknown>;

    private _dialog = inject(MatDialog);
    private _dialogRef: MatDialogRef<unknown> | null = null;

    readonly search = signal('');
    readonly selected = signal<Branch | null>(null);

    /** Demo data until the restaurant branches API lands (M2). */
    readonly branches: Branch[] = [
        { id: 'b1', name: 'PASSION_BÌNH DƯƠNG' },
        {
            id: 'b2',
            name: 'PASSION_ÂU DƯƠNG LÂN',
            lastOrderDate: '10-07-2026',
        },
        { id: 'b3', name: 'PASSION_CỘNG HÒA', lastOrderDate: '03-07-2026' },
        {
            id: 'b4',
            name: 'PASSION_ĐIỆN BIÊN PHỦ',
            lastOrderDate: '10-07-2026',
        },
        { id: 'b5', name: 'PASSION_FPT', lastOrderDate: '10-07-2026' },
        {
            id: 'b6',
            name: 'PASSION_LÝ THƯỜNG KIỆT',
            lastOrderDate: '10-07-2026',
        },
        { id: 'b7', name: 'PASSION_NGUYỄN TRÃI', lastOrderDate: '28-06-2026' },
        { id: 'b8', name: 'PASSION_QUẬN 7', lastOrderDate: '05-07-2026' },
    ];

    readonly filtered = computed(() => {
        const query = this.search().trim().toLowerCase();
        if (!query) {
            return this.branches;
        }
        return this.branches.filter((branch) =>
            branch.name.toLowerCase().includes(query)
        );
    });

    ngOnDestroy(): void {
        this._dialogRef?.close();
    }

    /** Two-letter monogram: first letters of the first and last name parts. */
    initials(name: string): string {
        const parts = name.split(/[_\s]+/).filter(Boolean);
        const first = parts[0]?.charAt(0) ?? '';
        const last = parts.length > 1 ? parts.at(-1)?.charAt(0) ?? '' : '';
        return (first + last).toUpperCase();
    }

    openPanel(): void {
        if (!this._panel || this._dialogRef) {
            return;
        }
        this._dialogRef = this._dialog.open(this._panel, {
            width: '40rem',
            maxWidth: 'calc(100vw - 2rem)',
            autoFocus: 'input',
        });
        this._dialogRef.afterClosed().subscribe(() => {
            this._dialogRef = null;
            this.search.set('');
        });
    }

    closePanel(): void {
        this._dialogRef?.close();
    }

    select(branch: Branch): void {
        this.selected.set(branch);
        this.closePanel();
    }
}
