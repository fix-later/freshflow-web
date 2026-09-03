import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    inject,
    input,
    output,
    signal,
    TemplateRef,
    ViewEncapsulation,
} from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * One picture, attached to something: a business licence, an avatar, the photo
 * on a claim.
 *
 * Every one of those had grown its own row of buttons beside a thumbnail —
 * "Đổi ảnh", "Xóa ảnh", "Tải lên" — which is three controls to say what the
 * picture itself can say. Here the tile *is* the control: empty it is a
 * dropzone that takes a click or a dragged file, and once there is an image the
 * actions sit on the image (view full size, replace, remove) as icons.
 *
 * Uploading stays with the caller — each of these posts to a different endpoint
 * with its own signature — so this emits the chosen {@link picked} file and
 * renders whatever `url` the caller ends up with.
 */
@Component({
    selector: 'image-upload-tile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './image-upload-tile.component.html',
    styleUrl: './image-upload-tile.component.scss',
    imports: [
        MatIconModule,
        MatTooltipModule,
        MatDialogModule,
        TranslocoModule,
    ],
})
export class ImageUploadTileComponent {
    private readonly _dialog = inject(MatDialog);

    /** The stored image, or `null` while there is none. */
    readonly url = input<string | null>(null);
    readonly uploading = input(false, { transform: booleanAttribute });
    readonly disabled = input(false, { transform: booleanAttribute });

    /** Round for an avatar, square-cornered for a document or a photo. */
    readonly circle = input(false, { transform: booleanAttribute });
    /** Tailwind sizing for the tile — height, and width when it is round. */
    readonly sizeClass = input('h-48 w-full');

    // Labels, so each caller keeps its own wording ("Thay giấy phép" is not
    // "Đổi ảnh") without this component owning a dictionary of its own.
    readonly uploadLabelKey = input('imageTile.upload');
    readonly dropHintKey = input('imageTile.drop');
    readonly viewLabelKey = input('imageTile.view');
    readonly changeLabelKey = input('imageTile.change');
    readonly removeLabelKey = input('imageTile.remove');
    readonly altKey = input('imageTile.alt');

    /** A file was chosen — by click or by drop. Uploading is the caller's job. */
    readonly picked = output<File>();
    readonly cleared = output<void>();

    readonly dragOver = signal(false);

    /** True while nothing may be picked, dropped or removed. */
    get locked(): boolean {
        return this.disabled() || this.uploading();
    }

    onDragOver(event: DragEvent): void {
        if (this.locked) {
            return;
        }
        event.preventDefault();
        this.dragOver.set(true);
    }

    onDragLeave(): void {
        this.dragOver.set(false);
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(false);
        if (this.locked) {
            return;
        }
        const file = event.dataTransfer?.files?.[0];
        if (file) {
            this.picked.emit(file);
        }
    }

    /** Reads the file picker, then clears it so the same file can be re-picked. */
    onPicked(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (file && !this.locked) {
            this.picked.emit(file);
        }
    }

    remove(): void {
        if (!this.locked) {
            this.cleared.emit();
        }
    }

    /**
     * Full size, in a dialog rather than a new tab: these tiles sit in forms
     * that are still being filled in, and a new tab leaves that behind.
     */
    openPreview(template: TemplateRef<unknown>): void {
        const url = this.url();
        if (!url) {
            return;
        }
        this._dialog.open(template, {
            data: { url },
            panelClass: 'image-preview-dialog',
            autoFocus: false,
            maxWidth: '96vw',
        });
    }
}
