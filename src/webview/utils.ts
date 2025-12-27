/**
 * Utility functions for the Epic Ladder webview
 */
import * as crypto from 'crypto';
import { marked } from 'marked';
import sanitizeHtmlLib from 'sanitize-html';
import { FilterOptions } from './renderers';

// Configure marked for GFM (GitHub Flavored Markdown)
marked.setOptions({
    gfm: true,
    breaks: true
});

/**
 * Sanitize HTML to prevent XSS attacks
 * Uses sanitize-html library for robust protection against XSS
 */
export function sanitizeHtml(html: string): string {
    return sanitizeHtmlLib(html, {
        allowedTags: [
            // Markdown commonly produces these tags
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'br', 'hr',
            'ul', 'ol', 'li',
            'blockquote', 'pre', 'code',
            'strong', 'b', 'em', 'i', 'u', 's', 'del',
            'a', 'img',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'div', 'span'
        ],
        allowedAttributes: {
            'a': ['href', 'title', 'target', 'rel'],
            'img': ['src', 'alt', 'title', 'width', 'height'],
            'th': ['align'],
            'td': ['align'],
            '*': ['class']
        },
        allowedSchemes: ['http', 'https', 'mailto'],
        allowedSchemesByTag: {
            img: ['http', 'https', 'data']
        },
        allowedSchemesAppliedToAttributes: ['href', 'src'],
        disallowedTagsMode: 'discard'
    });
}

/**
 * Render Markdown to sanitized HTML
 */
export function renderMarkdownToHtml(text: string): string {
    if (!text) return '';
    const html = marked.parse(text) as string;
    return sanitizeHtml(html);
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Count the number of active filters
 */
export function countActiveFilters(filterOptions?: FilterOptions, defaultStatuses?: string[]): number {
    if (!filterOptions) return 0;
    let count = 0;
    if (filterOptions.searchText) count++;
    if (filterOptions.versionId) count++;
    // ステータスフィルタ: デフォルトと異なる場合にカウント
    if (filterOptions.selectedStatuses && defaultStatuses) {
        const isDefault = filterOptions.selectedStatuses.length === defaultStatuses.length &&
            defaultStatuses.every(s => filterOptions.selectedStatuses!.includes(s));
        if (!isDefault) count++;
    }
    if (filterOptions.assigneeId) count++;
    if (filterOptions.trackerType) count++;
    // hideEmptyHierarchy はデフォルトがtrueなので、falseの場合のみカウント
    if (filterOptions.hideEmptyHierarchy === false) count++;
    return count;
}

/**
 * Generate a cryptographically secure random nonce for CSP
 * Uses Node.js crypto module for secure random generation
 */
export function getNonce(): string {
    return crypto.randomBytes(24).toString('base64url');
}
