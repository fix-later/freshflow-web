import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

// Every link the model writes opens in a new tab without handing it an
// opener reference — added once, globally, so it can't be forgotten per call.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
    }
});

/**
 * Renders assistant chat replies as markdown.
 *
 * The reply text comes from an LLM, not from this app, so it is treated as
 * untrusted: `marked` turns it into HTML and `DOMPurify` strips anything that
 * isn't plain prose markup (no `<script>`, no `on*` handlers, no `<style>`)
 * before Angular is told to trust it. Only assistant bubbles use this pipe —
 * the user's own turn is bound as plain text, since nothing they typed should
 * be reinterpreted as markup.
 */
@Pipe({
    name: 'markdownToHtml',
    standalone: true,
})
export class MarkdownToHtmlPipe implements PipeTransform {
    constructor(private readonly _sanitizer: DomSanitizer) {}

    transform(value: string | null | undefined): SafeHtml {
        if (!value) {
            return '';
        }
        const html = marked.parse(value, { async: false }) as string;
        const clean = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
                'p',
                'br',
                'strong',
                'em',
                'ul',
                'ol',
                'li',
                'a',
                'code',
                'pre',
                'blockquote',
                'h1',
                'h2',
                'h3',
                'h4',
                'hr',
                'table',
                'thead',
                'tbody',
                'tr',
                'th',
                'td',
            ],
            ALLOWED_ATTR: ['href', 'target', 'rel'],
        });
        return this._sanitizer.bypassSecurityTrustHtml(clean);
    }
}
