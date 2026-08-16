import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';

/** Compact circular avatar used by admin user tables. */
@Component({
    selector: 'admin-user-avatar',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'block shrink-0' },
    template: `
        <div
            class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-sm font-semibold uppercase text-primary-700 dark:bg-primary-900 dark:text-primary-200"
        >
            @if (avatarUrl()) {
                <img
                    class="h-full w-full object-cover"
                    [src]="avatarUrl()"
                    [alt]="label()"
                />
            } @else {
                <span aria-hidden="true">{{ initial() }}</span>
                <span class="sr-only">{{ label() }}</span>
            }
        </div>
    `,
})
export class AdminUserAvatarComponent {
    readonly avatarUrl = input<string | null | undefined>(null);
    readonly label = input('User');

    readonly initial = computed(() => {
        const value = this.label().trim();
        return value ? value.charAt(0) : '?';
    });
}
