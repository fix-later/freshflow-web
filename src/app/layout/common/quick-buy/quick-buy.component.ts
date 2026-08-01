import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';

interface QuickBuyMessage {
    role: 'user' | 'assistant';
    text: string;
}

/**
 * "Mua hàng nhanh" — the assistant trigger plus its fullscreen panel.
 *
 * Trigger and panel live in one component so a layout only drops in
 * `<quick-buy>`: previously the button and the overlay were separate halves of
 * the enterprise layout.
 *
 * The assistant itself is not wired to a backend yet; the panel says so rather
 * than pretending to answer.
 */
@Component({
    selector: 'quick-buy',
    templateUrl: './quick-buy.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
    imports: [FormsModule, MatIconModule, MatTooltipModule, TranslocoModule],
})
export class QuickBuyComponent {
    @ViewChild('chatInput') chatInput: ElementRef<HTMLInputElement>;

    opened = false;
    query = '';
    messages: QuickBuyMessage[] = [
        {
            role: 'assistant',
            text: "Hi! I'm FreshFlow AI. Ask me about products, orders, or delivery.",
        },
    ];

    open(): void {
        if (this.opened) {
            return;
        }
        this.opened = true;
        setTimeout(() => this.chatInput?.nativeElement.focus());
    }

    close(): void {
        if (!this.opened) {
            return;
        }
        this.query = '';
        this.opened = false;
    }

    onKeydown(event: KeyboardEvent): void {
        if (event.code === 'Escape') {
            this.close();
            return;
        }
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.send();
        }
    }

    send(): void {
        const text = this.query.trim();
        if (!text) {
            return;
        }

        this.messages = [...this.messages, { role: 'user', text }];
        this.query = '';

        setTimeout(() => {
            this.messages = [
                ...this.messages,
                {
                    role: 'assistant',
                    text: 'FreshFlow AI is not connected yet. Please browse the catalog or contact support.',
                },
            ];
        }, 500);
    }
}
