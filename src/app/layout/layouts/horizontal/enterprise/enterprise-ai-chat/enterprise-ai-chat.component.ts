import { NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    HostBinding,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { fuseAnimations } from '@fuse/animations/public-api';

interface AiChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

@Component({
    selector: 'enterprise-ai-chat',
    templateUrl: './enterprise-ai-chat.component.html',
    styleUrls: ['./enterprise-ai-chat.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    animations: fuseAnimations,
    standalone: true,
    imports: [FormsModule, MatButtonModule, MatIconModule, NgClass],
})
export class EnterpriseAiChatComponent {
    @ViewChild('chatInput') chatInput: ElementRef<HTMLInputElement>;

    opened = false;
    query = '';
    messages: AiChatMessage[] = [
        {
            role: 'assistant',
            text: "Hi! I'm FreshFlow AI. Ask me about products, orders, or delivery.",
        },
    ];

    @HostBinding('class') get classList(): Record<string, boolean> {
        return {
            'enterprise-ai-chat': true,
            'enterprise-ai-chat-opened': this.opened,
        };
    }

    open(): void {
        if (this.opened) {
            return;
        }

        this.opened = true;

        setTimeout(() => {
            this.chatInput?.nativeElement.focus();
        });
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
                    text: this.buildMockReply(text),
                },
            ];
        }, 500);
    }

    private buildMockReply(prompt: string): string {
        return `Thanks for your question about "${prompt}". FreshFlow AI will connect to the backend soon — for now this is a preview of the chat overlay.`;
    }
}
