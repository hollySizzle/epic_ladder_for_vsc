/**
 * Utility functions for the Epic Ladder webview
 */
import { marked } from 'marked';
import { ProjectStructureEpic } from '../types';
import { FilterOptions, AssigneeInfo } from './renderers';

// Configure marked for GFM (GitHub Flavored Markdown)
marked.setOptions({
    gfm: true,
    breaks: true
});

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes dangerous tags and attributes while preserving safe content
 */
export function sanitizeHtml(html: string): string {
    // Remove script tags and their content
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // Remove on* event handlers
    html = html.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
    // Remove javascript: URLs
    html = html.replace(/javascript:/gi, '');
    // Remove iframe, object, embed, form tags
    html = html.replace(/<(iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    html = html.replace(/<(iframe|object|embed|form)\b[^>]*\/?>/gi, '');
    // Remove style tags with potentially dangerous content
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    // Remove data: URLs (except for safe image types)
    html = html.replace(/data:(?!image\/(png|jpeg|gif|webp))[^"'\s]*/gi, '');
    return html;
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
 * Extract unique assignees from project structure
 */
export function extractAssignees(structure: ProjectStructureEpic[]): AssigneeInfo[] {
    const assigneeMap = new Map<string, string>();

    for (const epic of structure) {
        for (const feature of epic.features || []) {
            for (const story of feature.user_stories || []) {
                if (story.assigned_to) {
                    assigneeMap.set(story.assigned_to.id, story.assigned_to.name);
                }
                if (story.children) {
                    for (const task of story.children.tasks || []) {
                        if (task.assigned_to) {
                            assigneeMap.set(task.assigned_to.id, task.assigned_to.name);
                        }
                    }
                    for (const bug of story.children.bugs || []) {
                        if (bug.assigned_to) {
                            assigneeMap.set(bug.assigned_to.id, bug.assigned_to.name);
                        }
                    }
                    for (const test of story.children.tests || []) {
                        if (test.assigned_to) {
                            assigneeMap.set(test.assigned_to.id, test.assigned_to.name);
                        }
                    }
                }
            }
        }
    }

    return Array.from(assigneeMap.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
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
    if (filterOptions.hideEmptyHierarchy) count++;
    return count;
}

/**
 * Generate a random nonce for CSP
 */
export function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
