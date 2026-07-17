import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    NgZone,
    OnDestroy,
    TemplateRef,
    ViewChild,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { whenSplashHidden } from 'app/core/splash/wait-for-splash';

/** A restaurant branch (delivery address) selectable from the header. */
export interface Branch {
    id: string;
    name: string;
    lastOrderDate?: string;
}

/**
 * Header branch picker: the "Địa chỉ nhà hàng" button opens a popup listing
 * every branch with search; picking one makes it the active branch shown on
 * the button. On first load, if no branch is selected yet, the picker opens
 * automatically so a delivery address is always chosen. From the picker,
 * "Thêm mới" opens a create-branch form; saving adds it and selects it.
 */
@Component({
    selector: 'branch-picker',
    templateUrl: './branch-picker.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatCheckboxModule,
        MatIconModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class BranchPickerComponent implements AfterViewInit, OnDestroy {
    @ViewChild('branchPickerPanel') private _panel: TemplateRef<unknown>;
    @ViewChild('createBranchPanel') private _createPanel: TemplateRef<unknown>;

    private _dialog = inject(MatDialog);
    private _formBuilder = inject(FormBuilder);
    private _ngZone = inject(NgZone);
    private _dialogRef: MatDialogRef<unknown> | null = null;
    private _createDialogRef: MatDialogRef<unknown> | null = null;

    readonly search = signal('');
    readonly selected = signal<Branch | null>(null);

    /** Demo data until the restaurant branches API lands (M2). */
    readonly branches = signal<Branch[]>([
        { id: 'b1', name: 'PASSION_BÌNH DƯƠNG' },
        { id: 'b2', name: 'PASSION_ÂU DƯƠNG LÂN', lastOrderDate: '10-07-2026' },
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
    ]);

    readonly filtered = computed(() => {
        const query = this.search().trim().toLowerCase();
        const branches = this.branches();
        if (!query) {
            return branches;
        }
        return branches.filter((branch) =>
            branch.name.toLowerCase().includes(query)
        );
    });

    /** Reactive form backing the "Tạo cửa hàng" (create branch) dialog. */
    readonly createForm: FormGroup = this._formBuilder.group({
        name: ['', Validators.required],
        phone: ['', Validators.required],
        deliveryAddress: ['', Validators.required],
        note: [''],
        buyerName: [''],
        taxCode: [''],
        companyName: [''],
        invoiceEmail: ['', Validators.email],
        sameAsDelivery: [false],
        invoiceAddress: [''],
    });

    ngAfterViewInit(): void {
        // On first load, prompt for a delivery address if none is chosen yet —
        // but only once the splash screen is fully gone, so the picker never
        // surfaces underneath or during it. whenSplashHidden resolves off a
        // MutationObserver (outside Angular), so re-enter the zone to open.
        if (!this.selected()) {
            whenSplashHidden().then(() =>
                this._ngZone.run(() => this.openPanel())
            );
        }
    }

    ngOnDestroy(): void {
        this._createDialogRef?.close();
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

    /** Open the create-branch form (from the picker's "Thêm mới"). */
    openCreate(): void {
        if (!this._createPanel || this._createDialogRef) {
            return;
        }
        this.createForm.reset({ sameAsDelivery: false });
        this._createDialogRef = this._dialog.open(this._createPanel, {
            width: '52rem',
            maxWidth: 'calc(100vw - 2rem)',
            autoFocus: 'input',
        });
        this._createDialogRef.afterClosed().subscribe(() => {
            this._createDialogRef = null;
        });
    }

    closeCreate(): void {
        this._createDialogRef?.close();
    }

    /** Save the new branch (demo: append, select, and close both dialogs). */
    saveCreate(): void {
        if (this.createForm.invalid) {
            this.createForm.markAllAsTouched();
            return;
        }
        const branch: Branch = {
            id: `b${Date.now()}`,
            name: this.createForm.value.name.trim(),
        };
        this.branches.update((branches) => [branch, ...branches]);
        this.closeCreate();
        this.select(branch);
    }
}
