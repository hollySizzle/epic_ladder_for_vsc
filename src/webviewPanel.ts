import * as vscode from 'vscode';
import { marked } from 'marked';
import { McpClient } from './mcpClient';
import {
    GetProjectStructureResponse,
    ProjectStructureEpic,
    RedmineVersion
} from './types';

// Configure marked for GFM (GitHub Flavored Markdown)
marked.setOptions({
    gfm: true,
    breaks: true
});

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes dangerous tags and attributes while preserving safe content
 */
function sanitizeHtml(html: string): string {
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
function renderMarkdownToHtml(text: string): string {
    if (!text) return '';
    const html = marked.parse(text) as string;
    return sanitizeHtml(html);
}

export class EpicLadderWebviewProvider {
    public static readonly viewType = 'epicLadder.webview';
    private panel: vscode.WebviewPanel | undefined;
    private mcpClient: McpClient | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor(private readonly extensionUri: vscode.Uri) {}

    setMcpClient(client: McpClient | undefined): void {
        this.mcpClient = client;
    }

    async show(): Promise<void> {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two);
            await this.updateContent();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            EpicLadderWebviewProvider.viewType,
            'Epic Ladder',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.extensionUri]
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.disposables.forEach(d => d.dispose());
            this.disposables = [];
        }, null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleMessage(message);
            },
            null,
            this.disposables
        );

        await this.updateContent();
    }

    private async handleMessage(message: { command: string; [key: string]: unknown }): Promise<void> {
        switch (message.command) {
            case 'refresh':
                // フィルタ状態を保持してリフレッシュ
                await this.updateContent(message as FilterOptions);
                break;
            case 'openIssue':
                if (typeof message.issueId === 'string') {
                    await vscode.commands.executeCommand('redmine.openIssueById', message.issueId);
                }
                break;
            case 'openInBrowser':
                if (typeof message.url === 'string') {
                    await vscode.env.openExternal(vscode.Uri.parse(message.url));
                }
                break;
            case 'filter':
                await this.updateContent(message as FilterOptions);
                break;
            case 'getIssueDetail':
                if (typeof message.issueId === 'string' && this.mcpClient) {
                    try {
                        const detail = await this.mcpClient.getIssueDetail(message.issueId);
                        // Convert Markdown to HTML for description and journal notes
                        const processedDetail = {
                            ...detail,
                            issue: {
                                ...detail.issue,
                                descriptionHtml: renderMarkdownToHtml(detail.issue.description || '')
                            },
                            journals: detail.journals.map(journal => ({
                                ...journal,
                                notesHtml: renderMarkdownToHtml(journal.notes || '')
                            }))
                        };
                        this.panel?.webview.postMessage({
                            command: 'issueDetail',
                            issueId: message.issueId,
                            detail: processedDetail
                        });
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        this.panel?.webview.postMessage({
                            command: 'issueDetailError',
                            issueId: message.issueId,
                            error: errorMessage
                        });
                    }
                }
                break;
            case 'addComment':
                if (typeof message.issueId === 'string' && typeof message.comment === 'string' && this.mcpClient) {
                    try {
                        await this.mcpClient.addIssueComment(message.issueId, message.comment);
                        this.panel?.webview.postMessage({
                            command: 'commentSuccess',
                            issueId: message.issueId
                        });
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        this.panel?.webview.postMessage({
                            command: 'commentError',
                            issueId: message.issueId,
                            error: errorMessage
                        });
                    }
                }
                break;
            case 'updateStatus':
                if (typeof message.issueId === 'string' && typeof message.statusName === 'string' && this.mcpClient) {
                    try {
                        const result = await this.mcpClient.updateIssueStatus(
                            message.issueId,
                            message.statusName,
                            true
                        );
                        this.panel?.webview.postMessage({
                            command: 'statusUpdateSuccess',
                            issueId: message.issueId,
                            newStatus: result.new_status
                        });
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        this.panel?.webview.postMessage({
                            command: 'statusUpdateError',
                            issueId: message.issueId,
                            error: errorMessage
                        });
                    }
                }
                break;
        }
    }

    private async updateContent(filterOptions?: FilterOptions): Promise<void> {
        if (!this.panel) {
            return;
        }

        if (!this.mcpClient) {
            this.panel.webview.html = this.getNotConfiguredHtml();
            return;
        }

        try {
            const [structureResponse, versionsResponse] = await Promise.all([
                this.mcpClient.getProjectStructure({
                    max_depth: 4,
                    include_closed: filterOptions?.includeClosed ?? false,
                    version_id: filterOptions?.versionId
                }),
                this.mcpClient.listVersions({ status: 'all' })
            ]);

            this.panel.webview.html = this.getWebviewContent(
                structureResponse,
                versionsResponse.versions,
                filterOptions
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.panel.webview.html = this.getErrorHtml(message);
        }
    }

    private getWebviewContent(
        structure: GetProjectStructureResponse,
        versions: RedmineVersion[],
        filterOptions?: FilterOptions
    ): string {
        const nonce = this.getNonce();
        const assignees = this.extractAssignees(structure.structure);
        const trackerTypes = ['Epic', 'Feature', 'Story', 'Task', 'Bug', 'Test'];
        const statusTypes = ['未着手', '着手中', 'クローズ'];
        // デフォルト: 未着手と着手中を選択（Open Only相当）
        const defaultStatuses = ['未着手', '着手中'];
        const selectedStatuses = filterOptions?.selectedStatuses ?? defaultStatuses;
        const activeFilterCount = this.countActiveFilters(filterOptions, defaultStatuses);

        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>Epic Ladder</title>
    <style>
        ${this.getStyles()}
    </style>
</head>
<body>
    <div class="container">
        <div class="fixed-header">
            <header class="header">
                <h1>Epic Ladder</h1>
                <div class="header-actions">
                    <button class="btn btn-icon" onclick="refresh()" title="Refresh">
                        <span class="codicon">&#8635;</span>
                    </button>
                </div>
            </header>

            <button class="filter-toggle" onclick="toggleFilters()">
                <div class="hamburger">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span>Filters</span>
                ${activeFilterCount > 0 ? `<span class="filter-badge">${activeFilterCount}</span>` : ''}
            </button>

            <div class="filters" id="filtersPanel">
                <div class="filter-row">
                    <div class="filter-group">
                        <label for="searchInput">Search</label>
                        <input type="text" id="searchInput" placeholder="Search issues..."
                            value="${filterOptions?.searchText ?? ''}"
                            oninput="debounceSearch(this.value)">
                    </div>
                    <div class="filter-group">
                        <label for="versionFilter">Version</label>
                        <select id="versionFilter" onchange="applyFilters()">
                            <option value="">All Versions</option>
                            ${versions.map(v => `
                                <option value="${v.id}" ${filterOptions?.versionId === v.id ? 'selected' : ''}>
                                    ${this.escapeHtml(v.name)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="filter-group filter-group-status">
                        <label>Status</label>
                        <div class="multiselect-dropdown" id="statusDropdown">
                            <button type="button" class="multiselect-toggle" onclick="toggleStatusFilterDropdown()">
                                <span class="multiselect-text">${selectedStatuses.length > 0 ? selectedStatuses.join(', ') : 'Select...'}</span>
                                <span class="multiselect-arrow">▼</span>
                            </button>
                            <div class="multiselect-menu" id="statusFilterMenu">
                                ${statusTypes.map(status => `
                                    <label class="multiselect-option">
                                        <input type="checkbox" name="statusFilter" value="${this.escapeHtml(status)}"
                                            ${selectedStatuses.includes(status) ? 'checked' : ''}
                                            onchange="onStatusFilterChange()">
                                        <span>${this.escapeHtml(status)}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="filter-row">
                    <div class="filter-group">
                        <label for="assigneeFilter">Assignee</label>
                        <select id="assigneeFilter" onchange="applyClientFilters()">
                            <option value="">All Assignees</option>
                            ${assignees.map(a => `
                                <option value="${a.id}" ${filterOptions?.assigneeId === a.id ? 'selected' : ''}>
                                    ${this.escapeHtml(a.name)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="trackerFilter">Type</label>
                        <select id="trackerFilter" onchange="applyClientFilters()">
                            <option value="">All Types</option>
                            ${trackerTypes.map(t => `
                                <option value="${t}" ${filterOptions?.trackerType === t ? 'selected' : ''}>
                                    ${t}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="filter-group filter-checkbox">
                        <label class="inline-checkbox">
                            <input type="checkbox" id="hideEmptyHierarchy"
                                ${filterOptions?.hideEmptyHierarchy ? 'checked' : ''}
                                onchange="applyClientFilters()">
                            <span>空の階層を非表示</span>
                        </label>
                    </div>
                    <div class="filter-group filter-actions">
                        <label>&nbsp;</label>
                        <button class="btn btn-clear" onclick="clearAllFilters()" title="Clear all filters">
                            Clear Filters
                        </button>
                    </div>
                </div>
                ${activeFilterCount > 0 ? `
                    <div class="active-filters">
                        <span class="active-filters-label">Active:</span>
                        ${this.renderActiveFilterBadges(filterOptions, versions, assignees, defaultStatuses)}
                    </div>
                ` : ''}
            </div>

            <div class="summary">
                <span class="summary-item">
                    <span class="badge badge-epic">${structure.summary.total_epics}</span> Epics
                </span>
                <span class="summary-item">
                    <span class="badge badge-feature">${structure.summary.total_features}</span> Features
                </span>
                <span class="summary-item">
                    <span class="badge badge-story">${structure.summary.total_user_stories}</span> Stories
                </span>
                <span class="summary-item">
                    <span class="badge badge-task">${structure.summary.total_tasks}</span> Tasks
                </span>
                <span class="summary-item">
                    <span class="badge badge-bug">${structure.summary.total_bugs}</span> Bugs
                </span>
                <span class="summary-item">
                    <span class="badge badge-test">${structure.summary.total_tests}</span> Tests
                </span>
            </div>
        </div>

        <div class="scrollable-content">
            <div class="tree-container" id="treeContainer">
                ${this.renderEpics(structure.structure)}
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        ${this.getScript()}
    </script>
</body>
</html>`;
    }

    private renderEpics(epics: ProjectStructureEpic[]): string {
        if (!epics || epics.length === 0) {
            return '<div class="empty-state">No epics found</div>';
        }

        return epics.map(epic => `
            <div class="tree-item tree-item-epic" data-id="${epic.id}">
                <div class="tree-item-header" onclick="toggleDetail(event, '${epic.id}')">
                    <span class="collapse-icon" onclick="event.stopPropagation(); toggleCollapse(this.parentElement)">&#9662;</span>
                    <span class="type-badge badge-epic">Epic</span>
                    ${this.renderStatusBadge(epic.id, epic.status)}
                    <span class="issue-id" onclick="event.stopPropagation(); openIssue('${epic.id}')">#${epic.id}</span>
                    <span class="issue-subject">${this.escapeHtml(epic.subject)}</span>
                </div>
                <div class="tree-children">
                    ${this.renderFeatures(epic.features)}
                </div>
            </div>
        `).join('');
    }

    private renderFeatures(features: ProjectStructureEpic['features']): string {
        if (!features || features.length === 0) {
            return '';
        }

        return features.map(feature => `
            <div class="tree-item tree-item-feature" data-id="${feature.id}">
                <div class="tree-item-header" onclick="toggleDetail(event, '${feature.id}')">
                    <span class="collapse-icon" onclick="event.stopPropagation(); toggleCollapse(this.parentElement)">&#9662;</span>
                    <span class="type-badge badge-feature">Feature</span>
                    ${this.renderStatusBadge(feature.id, feature.status)}
                    <span class="issue-id" onclick="event.stopPropagation(); openIssue('${feature.id}')">#${feature.id}</span>
                    <span class="issue-subject">${this.escapeHtml(feature.subject)}</span>
                </div>
                <div class="tree-children">
                    ${this.renderUserStories(feature.user_stories)}
                </div>
            </div>
        `).join('');
    }

    private renderUserStories(stories: ProjectStructureEpic['features'][0]['user_stories']): string {
        if (!stories || stories.length === 0) {
            return '';
        }

        return stories.map(story => {
            const hasChildren = story.children && (
                story.children.tasks.length > 0 ||
                story.children.bugs.length > 0 ||
                story.children.tests.length > 0
            );

            const metaInfo = (story.assigned_to || story.version) ? `
                <div class="meta-info">
                    ${story.assigned_to ? `<span class="assignee">@${this.escapeHtml(story.assigned_to.name)}</span>` : ''}
                    ${story.version ? `<span class="version">${this.escapeHtml(story.version.name)}</span>` : ''}
                </div>
            ` : '';

            return `
                <div class="tree-item tree-item-story" data-id="${story.id}">
                    <div class="tree-item-header ${hasChildren ? '' : 'no-children'}" onclick="toggleDetail(event, '${story.id}')">
                        ${hasChildren ? `<span class="collapse-icon" onclick="event.stopPropagation(); toggleCollapse(this.parentElement)">&#9662;</span>` : '<span class="collapse-icon-placeholder"></span>'}
                        <span class="type-badge badge-story">Story</span>
                        ${this.renderStatusBadge(story.id, story.status)}
                        <span class="issue-id" onclick="event.stopPropagation(); openIssue('${story.id}')">#${story.id}</span>
                        <span class="issue-subject">${this.escapeHtml(story.subject)}</span>
                        ${metaInfo}
                    </div>
                    ${hasChildren ? `
                        <div class="tree-children">
                            ${this.renderChildren(story.children!)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    private renderChildren(children: NonNullable<ProjectStructureEpic['features'][0]['user_stories'][0]['children']>): string {
        const items: string[] = [];

        children.tasks.forEach(task => {
            items.push(this.renderLeafItem(task, 'Task', 'badge-task'));
        });

        children.bugs.forEach(bug => {
            items.push(this.renderLeafItem(bug, 'Bug', 'badge-bug'));
        });

        children.tests.forEach(test => {
            items.push(this.renderLeafItem(test, 'Test', 'badge-test'));
        });

        return items.join('');
    }

    private renderLeafItem(
        item: { id: string; subject: string; status: { name: string; is_closed: boolean }; assigned_to?: { name: string } },
        type: string,
        badgeClass: string
    ): string {
        const metaInfo = item.assigned_to ? `
            <div class="meta-info">
                <span class="assignee">@${this.escapeHtml(item.assigned_to.name)}</span>
            </div>
        ` : '';

        return `
            <div class="tree-item tree-item-leaf" data-id="${item.id}">
                <div class="tree-item-header no-children" onclick="toggleDetail(event, '${item.id}')">
                    <span class="collapse-icon-placeholder"></span>
                    <span class="type-badge ${badgeClass}">${type}</span>
                    ${this.renderStatusBadge(item.id, item.status)}
                    <span class="issue-id" onclick="event.stopPropagation(); openIssue('${item.id}')">#${item.id}</span>
                    <span class="issue-subject">${this.escapeHtml(item.subject)}</span>
                    ${metaInfo}
                </div>
            </div>
        `;
    }

    private getStatusClass(status: { name: string; is_closed: boolean }): string {
        if (status.is_closed) {
            return 'status-closed';
        }
        const name = status.name.toLowerCase();
        if (name.includes('progress') || name.includes('着手') || name.includes('進行')) {
            return 'status-in-progress';
        }
        if (name.includes('review') || name.includes('レビュー')) {
            return 'status-review';
        }
        if (name.includes('block') || name.includes('保留')) {
            return 'status-blocked';
        }
        return 'status-open';
    }

    private renderStatusBadge(issueId: string, status: { name: string; is_closed: boolean }): string {
        const statusOptions = ['未着手', '着手中', 'クローズ'];
        const optionsHtml = statusOptions.map(opt =>
            `<div class="status-option" data-status="${this.escapeHtml(opt)}">${this.escapeHtml(opt)}</div>`
        ).join('');

        return `
            <div class="status-dropdown" data-issue-id="${issueId}">
                <span class="status-badge status-clickable ${this.getStatusClass(status)}"
                      onclick="event.stopPropagation(); toggleStatusDropdown(event, '${issueId}')">
                    ${this.escapeHtml(status.name)}
                    <span class="status-dropdown-arrow">▼</span>
                </span>
                <div class="status-dropdown-menu" id="statusMenu-${issueId}">
                    ${optionsHtml}
                </div>
            </div>
        `;
    }

    private getStyles(): string {
        return `
            :root {
                --bg-color: var(--vscode-editor-background);
                --text-color: var(--vscode-editor-foreground);
                --border-color: var(--vscode-panel-border);
                --hover-bg: var(--vscode-list-hoverBackground);
                --focus-bg: var(--vscode-list-activeSelectionBackground);
                --input-bg: var(--vscode-input-background);
                --input-border: var(--vscode-input-border);
                --button-bg: var(--vscode-button-background);
                --button-fg: var(--vscode-button-foreground);
                --indent-size: 24px;
            }

            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            html, body {
                height: 100%;
                margin: 0;
                overflow: hidden;
            }

            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--text-color);
                background: var(--bg-color);
                line-height: 1.5;
            }

            .container {
                max-width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                container-type: inline-size;
            }

            .fixed-header {
                flex-shrink: 0;
                padding: 12px 12px 0 12px;
            }

            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--border-color);
            }

            .header h1 {
                font-size: 1.2em;
                font-weight: 600;
            }

            .header-actions {
                display: flex;
                gap: 4px;
            }

            .btn {
                background: var(--button-bg);
                color: var(--button-fg);
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            }

            .btn:hover {
                opacity: 0.9;
            }

            .btn-icon {
                padding: 4px 8px;
                font-size: 16px;
            }

            /* Filter toggle button (narrow width) */
            .filter-toggle {
                display: none;
                align-items: center;
                gap: 6px;
                background: var(--vscode-sideBar-background);
                border: 1px solid var(--border-color);
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                color: var(--text-color);
                font-size: 13px;
                margin-bottom: 8px;
                width: 100%;
            }

            .filter-toggle .hamburger {
                display: flex;
                flex-direction: column;
                gap: 3px;
            }

            .filter-toggle .hamburger span {
                display: block;
                width: 16px;
                height: 2px;
                background: var(--text-color);
                border-radius: 1px;
            }

            .filter-badge {
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 10px;
                margin-left: auto;
            }

            .filters {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 12px;
                padding: 12px;
                background: var(--vscode-sideBar-background);
                border-radius: 6px;
            }

            .filters.collapsed {
                display: none;
            }

            .filter-row {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }

            .filter-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
                flex: 1;
                min-width: 120px;
            }

            .filter-actions {
                flex: 0 0 auto;
                min-width: auto;
            }

            .btn-clear {
                background: transparent;
                color: var(--vscode-textLink-foreground);
                border: 1px solid var(--border-color);
                font-size: 12px;
                padding: 5px 10px;
            }

            .btn-clear:hover {
                background: var(--hover-bg);
            }

            .active-filters {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                align-items: center;
                padding-top: 8px;
                border-top: 1px solid var(--border-color);
            }

            .active-filters-label {
                font-size: 10px;
                color: var(--vscode-descriptionForeground);
                text-transform: uppercase;
            }

            .active-filter-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 11px;
            }

            .remove-filter {
                cursor: pointer;
                opacity: 0.7;
                font-weight: bold;
                padding: 0 2px;
            }

            .remove-filter:hover {
                opacity: 1;
            }

            .filter-group label {
                font-size: 10px;
                text-transform: uppercase;
                opacity: 0.8;
            }

            .filter-group input[type="text"],
            .filter-group select {
                background: var(--input-bg);
                color: var(--text-color);
                border: 1px solid var(--input-border);
                padding: 6px 8px;
                border-radius: 4px;
                font-size: 13px;
                width: 100%;
            }

            .filter-group input[type="text"]:focus,
            .filter-group select:focus {
                outline: 1px solid var(--vscode-focusBorder);
            }

            /* Multiselect Dropdown */
            .filter-group-status {
                min-width: 140px;
            }

            .multiselect-dropdown {
                position: relative;
            }

            .multiselect-toggle {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
                background: var(--input-bg);
                color: var(--text-color);
                border: 1px solid var(--input-border);
                padding: 6px 8px;
                border-radius: 4px;
                font-size: 13px;
                cursor: pointer;
                text-align: left;
            }

            .multiselect-toggle:hover {
                background: var(--hover-bg);
            }

            .multiselect-toggle:focus {
                outline: 1px solid var(--vscode-focusBorder);
            }

            .multiselect-text {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .multiselect-arrow {
                font-size: 8px;
                margin-left: 6px;
                opacity: 0.7;
            }

            .multiselect-menu {
                display: none;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                z-index: 1000;
                background: var(--vscode-dropdown-background);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                margin-top: 2px;
                max-height: 200px;
                overflow-y: auto;
            }

            .multiselect-menu.open {
                display: block;
            }

            .multiselect-option {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 10px;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.1s;
            }

            .multiselect-option:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .multiselect-option input[type="checkbox"] {
                width: 14px;
                height: 14px;
                margin: 0;
                cursor: pointer;
                accent-color: var(--vscode-button-background);
            }

            .multiselect-option span {
                flex: 1;
            }

            /* Inline Checkbox (空の階層を非表示) */
            .filter-checkbox {
                flex: 0 0 auto;
                min-width: auto;
                display: flex;
                align-items: flex-end;
            }

            .inline-checkbox {
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                font-size: 12px;
                padding: 6px 0;
                white-space: nowrap;
            }

            .inline-checkbox input[type="checkbox"] {
                width: 14px;
                height: 14px;
                margin: 0;
                cursor: pointer;
                accent-color: var(--vscode-button-background);
            }

            .inline-checkbox span {
                opacity: 0.9;
            }

            .summary {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 12px;
                padding: 8px;
                background: var(--vscode-sideBar-background);
                border-radius: 6px;
                flex-shrink: 0;
            }

            .scrollable-content {
                flex: 1;
                overflow-y: auto;
                padding: 0 12px 12px 12px;
                min-height: 0;
            }

            .summary-item {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
            }

            .badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 10px;
                font-weight: 600;
            }

            .badge-epic { background: #f59e0b; color: #000; }
            .badge-feature { background: #f97316; color: #000; }
            .badge-story { background: #3b82f6; color: #fff; }
            .badge-task { background: #22c55e; color: #000; }
            .badge-bug { background: #ef4444; color: #fff; }
            .badge-test { background: #a855f7; color: #fff; }

            .tree-container {
                border: 1px solid var(--border-color);
                border-radius: 6px;
                overflow: hidden;
            }

            .tree-item {
                border-bottom: 1px solid var(--border-color);
            }

            .tree-item:last-child {
                border-bottom: none;
            }

            .tree-item-header {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 10px;
                cursor: pointer;
                transition: background 0.15s;
            }

            .tree-item-header:hover {
                background: var(--hover-bg);
            }

            .tree-item-header.no-children {
                cursor: default;
            }

            .collapse-icon {
                font-size: 10px;
                transition: transform 0.2s;
                width: 12px;
                flex-shrink: 0;
                text-align: center;
            }

            .collapse-icon-placeholder {
                width: 12px;
                flex-shrink: 0;
            }

            .tree-item.collapsed .collapse-icon {
                transform: rotate(-90deg);
            }

            .tree-item.collapsed > .tree-children {
                display: none;
            }

            .tree-children {
                padding-left: var(--indent-size);
                border-top: 1px solid var(--border-color);
                position: relative;
            }

            /* Indent guide (vertical line) for tree hierarchy */
            .tree-children::before {
                content: '';
                position: absolute;
                left: 10px;
                top: 0;
                bottom: 0;
                width: 1px;
                background: var(--vscode-tree-indentGuidesStroke, var(--border-color));
                opacity: 0.5;
            }

            .type-badge {
                font-size: 9px;
                padding: 1px 5px;
                border-radius: 4px;
                font-weight: 500;
                flex-shrink: 0;
            }

            .status-badge {
                font-size: 9px;
                padding: 1px 5px;
                border-radius: 4px;
                flex-shrink: 0;
            }

            .status-open { background: var(--vscode-statusBarItem-warningBackground); color: var(--vscode-statusBarItem-warningForeground); }
            .status-in-progress { background: #3b82f6; color: #fff; }
            .status-review { background: #a855f7; color: #fff; }
            .status-blocked { background: #f97316; color: #000; }
            .status-closed { background: #22c55e; color: #000; }

            /* Status Dropdown Styles */
            .status-dropdown {
                position: relative;
                display: inline-block;
                flex-shrink: 0;
            }

            .status-clickable {
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 3px;
                transition: opacity 0.15s;
            }

            .status-clickable:hover {
                opacity: 0.85;
            }

            .status-dropdown-arrow {
                font-size: 6px;
                opacity: 0.7;
            }

            .status-dropdown-menu {
                display: none;
                position: absolute;
                top: 100%;
                left: 0;
                z-index: 1000;
                min-width: 100px;
                background: var(--vscode-dropdown-background);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                margin-top: 2px;
            }

            .status-dropdown-menu.open {
                display: block;
            }

            .status-option {
                padding: 6px 10px;
                font-size: 11px;
                cursor: pointer;
                white-space: nowrap;
            }

            .status-option:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .status-option:first-child {
                border-radius: 4px 4px 0 0;
            }

            .status-option:last-child {
                border-radius: 0 0 4px 4px;
            }

            .status-updating {
                opacity: 0.6;
                pointer-events: none;
            }

            .status-updating::after {
                content: '';
                display: inline-block;
                width: 8px;
                height: 8px;
                margin-left: 4px;
                border: 1px solid currentColor;
                border-top-color: transparent;
                border-radius: 50%;
                animation: spin 0.6s linear infinite;
            }

            .issue-id {
                font-family: monospace;
                font-size: 11px;
                color: var(--vscode-textLink-foreground);
                cursor: pointer;
                flex-shrink: 0;
            }

            .issue-id:hover {
                text-decoration: underline;
            }

            .issue-subject {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                min-width: 0;
            }

            .meta-info {
                display: flex;
                gap: 6px;
                flex-shrink: 0;
            }

            .assignee {
                font-size: 10px;
                opacity: 0.8;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 1px 5px;
                border-radius: 4px;
                max-width: 80px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .version {
                font-size: 10px;
                opacity: 0.8;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 1px 5px;
                border-radius: 4px;
                max-width: 80px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .empty-state {
                padding: 32px;
                text-align: center;
                color: var(--vscode-descriptionForeground);
            }

            .tree-item.search-hidden {
                display: none;
            }

            .tree-item.search-match .issue-subject {
                background: var(--vscode-editor-findMatchHighlightBackground);
            }

            /* ========================================
               Narrow Width Optimization (< 500px)
               ======================================== */
            @container (max-width: 500px) {
                :root {
                    --indent-size: 10px;
                }

                .fixed-header {
                    padding: 8px 8px 0 8px;
                }

                .scrollable-content {
                    padding: 0 8px 8px 8px;
                }

                .header {
                    margin-bottom: 8px;
                }

                .header h1 {
                    font-size: 1em;
                }

                /* Show filter toggle button */
                .filter-toggle {
                    display: flex;
                }

                /* Filters become collapsible */
                .filters {
                    gap: 8px;
                    padding: 10px;
                    margin-bottom: 8px;
                }

                .filter-row {
                    flex-direction: column;
                    gap: 8px;
                }

                .filter-group {
                    min-width: unset;
                }

                .filter-actions {
                    flex: 1;
                }

                .btn-clear {
                    width: 100%;
                }

                .active-filters {
                    flex-direction: row;
                    padding-top: 6px;
                }

                .active-filter-badge {
                    font-size: 10px;
                    padding: 2px 6px;
                }

                /* Multiselect dropdown for narrow screens */
                .multiselect-toggle {
                    padding: 5px 6px;
                    font-size: 12px;
                }

                .multiselect-option {
                    padding: 6px 8px;
                    font-size: 11px;
                }

                /* Summary wraps into 2 rows */
                .summary {
                    gap: 6px;
                    padding: 6px 8px;
                    margin-bottom: 8px;
                }

                .summary-item {
                    font-size: 10px;
                }

                .badge {
                    padding: 1px 4px;
                    font-size: 9px;
                }

                /* Tree item: multi-line layout */
                .tree-item-header {
                    flex-wrap: wrap;
                    padding: 8px;
                    gap: 4px;
                }

                /* Row 1: Type badge + Subject (wrap enabled) */
                .issue-subject {
                    order: 1;
                    flex-basis: calc(100% - 40px);
                    white-space: normal;
                    word-break: break-word;
                    line-height: 1.3;
                }

                .collapse-icon,
                .collapse-icon-placeholder {
                    order: 0;
                }

                .type-badge {
                    order: 2;
                }

                /* Row 2: ID, Status, Assignee, Version */
                .issue-id {
                    order: 3;
                    font-size: 10px;
                }

                .status-badge {
                    order: 4;
                }

                .meta-info {
                    order: 5;
                    flex-basis: 100%;
                    margin-top: 2px;
                }

                .assignee,
                .version {
                    font-size: 9px;
                    max-width: 100px;
                }

                /* Reduce tree indent */
                .tree-children {
                    padding-left: 10px;
                }

                /* Adjust indent guide position for narrow width */
                .tree-children::before {
                    left: 4px;
                }
            }

            /* Extra narrow (< 350px) */
            @container (max-width: 350px) {
                .header h1 {
                    font-size: 0.9em;
                }

                .tree-item-header {
                    padding: 6px;
                }

                .type-badge {
                    font-size: 8px;
                    padding: 1px 4px;
                }

                .status-badge {
                    font-size: 8px;
                    padding: 1px 4px;
                }

                .issue-id {
                    font-size: 9px;
                }

                .tree-children {
                    padding-left: 8px;
                }

                /* Adjust indent guide position for extra narrow width */
                .tree-children::before {
                    left: 3px;
                }

                .summary-item {
                    font-size: 9px;
                }
            }

            /* ========================================
               Issue Detail Panel Styles
               ======================================== */
            .issue-detail-panel {
                background: var(--vscode-sideBar-background);
                border-top: 1px solid var(--border-color);
                padding: 12px;
                display: none;
                animation: slideDown 0.2s ease-out;
            }

            .issue-detail-panel.open {
                display: block;
            }

            @keyframes slideDown {
                from {
                    opacity: 0;
                    max-height: 0;
                }
                to {
                    opacity: 1;
                    max-height: 500px;
                }
            }

            .detail-loading {
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--vscode-descriptionForeground);
                font-size: 12px;
            }

            .detail-loading::before {
                content: '';
                width: 14px;
                height: 14px;
                border: 2px solid var(--vscode-descriptionForeground);
                border-top-color: transparent;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            .detail-error {
                color: var(--vscode-errorForeground);
                font-size: 12px;
            }

            .detail-header {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--border-color);
            }

            .detail-info-item {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
            }

            .detail-info-label {
                color: var(--vscode-descriptionForeground);
            }

            .detail-info-value {
                color: var(--text-color);
            }

            .detail-progress {
                margin-bottom: 12px;
            }

            .progress-bar {
                height: 6px;
                background: var(--vscode-progressBar-background);
                border-radius: 3px;
                overflow: hidden;
                margin-top: 4px;
            }

            .progress-bar-fill {
                height: 100%;
                background: var(--vscode-progressBar-background);
                background: #22c55e;
                transition: width 0.3s ease;
            }

            .progress-text {
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
            }

            .detail-description {
                font-size: 12px;
                line-height: 1.6;
            }

            .detail-description-label {
                font-size: 10px;
                text-transform: uppercase;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 6px;
            }

            .detail-description-content {
                background: var(--vscode-editor-background);
                padding: 10px;
                border-radius: 4px;
                border: 1px solid var(--border-color);
                max-height: 200px;
                overflow-y: auto;
            }

            .detail-description-content:empty::after {
                content: 'No description';
                color: var(--vscode-descriptionForeground);
                font-style: italic;
            }

            /* Markdown rendered styles */
            .detail-description-content h1,
            .detail-description-content h2,
            .detail-description-content h3 {
                margin: 12px 0 6px 0;
                font-weight: 600;
            }

            .detail-description-content h1 { font-size: 1.3em; }
            .detail-description-content h2 { font-size: 1.1em; }
            .detail-description-content h3 { font-size: 1em; }

            .detail-description-content p {
                margin: 6px 0;
            }

            .detail-description-content ul,
            .detail-description-content ol {
                margin: 6px 0;
                padding-left: 20px;
            }

            .detail-description-content li {
                margin: 2px 0;
            }

            .detail-description-content code {
                background: var(--vscode-textCodeBlock-background);
                padding: 1px 4px;
                border-radius: 3px;
                font-family: var(--vscode-editor-font-family);
                font-size: 0.9em;
            }

            .detail-description-content pre {
                background: var(--vscode-textCodeBlock-background);
                padding: 8px;
                border-radius: 4px;
                overflow-x: auto;
                margin: 8px 0;
            }

            .detail-description-content pre code {
                padding: 0;
                background: none;
            }

            .detail-description-content blockquote {
                border-left: 3px solid var(--vscode-textBlockQuote-border);
                margin: 8px 0;
                padding-left: 12px;
                color: var(--vscode-textBlockQuote-foreground);
            }

            .detail-description-content a {
                color: var(--vscode-textLink-foreground);
            }

            .detail-description-content a:hover {
                text-decoration: underline;
            }

            .detail-description-content hr {
                border: none;
                border-top: 1px solid var(--border-color);
                margin: 12px 0;
            }

            .detail-actions {
                margin-top: 12px;
                display: flex;
                gap: 8px;
            }

            .detail-actions .btn {
                font-size: 11px;
                padding: 4px 10px;
            }

            /* Selected item highlight */
            .tree-item.detail-open > .tree-item-header {
                background: var(--vscode-list-activeSelectionBackground);
            }

            /* ========================================
               Comments Section Styles
               ======================================== */
            .detail-comments {
                margin-top: 12px;
            }

            .detail-comments-label {
                font-size: 10px;
                text-transform: uppercase;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 6px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .comments-count {
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 1px 6px;
                border-radius: 10px;
                font-size: 10px;
            }

            .comments-list {
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid var(--border-color);
                border-radius: 4px;
                background: var(--vscode-editor-background);
            }

            .comment-item {
                padding: 10px;
                border-bottom: 1px solid var(--border-color);
            }

            .comment-item:last-child {
                border-bottom: none;
            }

            .comment-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
                flex-wrap: wrap;
            }

            .comment-author {
                font-weight: 600;
                font-size: 12px;
                color: var(--vscode-textLink-foreground);
            }

            .comment-date {
                font-size: 10px;
                color: var(--vscode-descriptionForeground);
            }

            .comment-body {
                font-size: 12px;
                line-height: 1.5;
            }

            .comment-body:empty {
                display: none;
            }

            .comment-body ul,
            .comment-body ol {
                margin: 6px 0;
                padding-left: 24px;
            }

            .comment-body li {
                margin: 2px 0;
            }

            .comment-body p {
                margin: 6px 0;
            }

            .comment-body code {
                background: var(--vscode-textCodeBlock-background);
                padding: 1px 4px;
                border-radius: 3px;
                font-family: var(--vscode-editor-font-family);
                font-size: 0.9em;
            }

            .comment-body pre {
                background: var(--vscode-textCodeBlock-background);
                padding: 8px;
                border-radius: 4px;
                overflow-x: auto;
                margin: 8px 0;
            }

            .comment-body pre code {
                padding: 0;
                background: none;
            }

            .comment-body blockquote {
                border-left: 3px solid var(--vscode-textBlockQuote-border);
                margin: 8px 0;
                padding-left: 12px;
                color: var(--vscode-textBlockQuote-foreground);
            }

            .comment-body a {
                color: var(--vscode-textLink-foreground);
            }

            .comment-body h1,
            .comment-body h2,
            .comment-body h3 {
                margin: 12px 0 6px 0;
                font-weight: 600;
            }

            .comment-body h1 { font-size: 1.2em; }
            .comment-body h2 { font-size: 1.1em; }
            .comment-body h3 { font-size: 1em; }

            /* Change details (status changes, etc.) */
            .comment-changes {
                margin-top: 6px;
            }

            .change-item {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
                padding: 2px 0;
            }

            .change-label {
                font-weight: 500;
            }

            .change-old {
                text-decoration: line-through;
                opacity: 0.7;
            }

            .change-arrow {
                color: var(--vscode-textLink-foreground);
            }

            .change-new {
                color: var(--text-color);
            }

            .no-comments {
                padding: 16px;
                text-align: center;
                color: var(--vscode-descriptionForeground);
                font-size: 12px;
                font-style: italic;
            }

            /* ========================================
               Comment Input Form Styles
               ======================================== */
            .comment-input-section {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid var(--border-color);
            }

            .comment-input-label {
                font-size: 10px;
                text-transform: uppercase;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 6px;
            }

            .comment-input-wrapper {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .comment-textarea {
                width: 100%;
                min-height: 80px;
                padding: 8px;
                background: var(--input-bg);
                color: var(--text-color);
                border: 1px solid var(--input-border);
                border-radius: 4px;
                font-family: var(--vscode-font-family);
                font-size: 12px;
                resize: vertical;
            }

            .comment-textarea:focus {
                outline: 1px solid var(--vscode-focusBorder);
            }

            .comment-textarea::placeholder {
                color: var(--vscode-input-placeholderForeground);
            }

            .comment-input-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }

            .comment-submit-btn {
                background: var(--button-bg);
                color: var(--button-fg);
                border: none;
                padding: 6px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .comment-submit-btn:hover {
                opacity: 0.9;
            }

            .comment-submit-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .comment-submit-btn.loading::before {
                content: '';
                width: 12px;
                height: 12px;
                border: 2px solid var(--button-fg);
                border-top-color: transparent;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            .comment-submit-success {
                color: #22c55e;
                font-size: 11px;
                display: none;
                align-items: center;
                gap: 4px;
            }

            .comment-submit-success.show {
                display: flex;
            }

            .comment-submit-error {
                color: var(--vscode-errorForeground);
                font-size: 11px;
                display: none;
            }

            .comment-submit-error.show {
                display: block;
            }

            @container (max-width: 500px) {
                .issue-detail-panel {
                    padding: 10px;
                }

                .detail-header {
                    gap: 6px;
                }

                .detail-info-item {
                    font-size: 10px;
                }

                .detail-description-content {
                    max-height: 150px;
                    padding: 8px;
                }

                .comments-list {
                    max-height: 200px;
                }

                .comment-item {
                    padding: 8px;
                }

                .comment-author {
                    font-size: 11px;
                }

                .comment-body {
                    font-size: 11px;
                }

                .comment-textarea {
                    min-height: 60px;
                }
            }
        `;
    }

    private getScript(): string {
        return `
            const vscode = acquireVsCodeApi();
            let searchTimeout;
            let filtersCollapsed = true;

            function refresh() {
                // フィルタ状態を保持してリフレッシュ
                const currentFilters = getCurrentFilterState();
                vscode.postMessage({ command: 'refresh', ...currentFilters });
            }

            function getCurrentFilterState() {
                const versionFilter = document.getElementById('versionFilter');
                const assigneeFilter = document.getElementById('assigneeFilter');
                const trackerFilter = document.getElementById('trackerFilter');
                const searchInput = document.getElementById('searchInput');
                const hideEmptyCheckbox = document.getElementById('hideEmptyHierarchy');
                const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]:checked');

                const selectedStatuses = Array.from(statusCheckboxes).map(cb => cb.value);
                const includesClosed = selectedStatuses.includes('クローズ');

                return {
                    versionId: versionFilter?.value || undefined,
                    assigneeId: assigneeFilter?.value || undefined,
                    trackerType: trackerFilter?.value || undefined,
                    searchText: searchInput?.value || undefined,
                    selectedStatuses: selectedStatuses,
                    includeClosed: includesClosed,
                    hideEmptyHierarchy: hideEmptyCheckbox?.checked || false
                };
            }

            function toggleFilters() {
                const filtersPanel = document.getElementById('filtersPanel');
                if (filtersPanel) {
                    filtersCollapsed = !filtersCollapsed;
                    filtersPanel.classList.toggle('collapsed', filtersCollapsed);
                }
            }

            // Initialize filters state on narrow screens
            function initFilters() {
                const container = document.querySelector('.container');
                if (container && container.offsetWidth <= 500) {
                    const filtersPanel = document.getElementById('filtersPanel');
                    if (filtersPanel) {
                        filtersPanel.classList.add('collapsed');
                    }
                } else {
                    filtersCollapsed = false;
                }
            }

            // Run on load
            initFilters();

            // ========================================
            // Status Filter Multiselect Dropdown
            // ========================================
            let statusFilterMenuOpen = false;

            function toggleStatusFilterDropdown() {
                const menu = document.getElementById('statusFilterMenu');
                if (!menu) return;

                statusFilterMenuOpen = !statusFilterMenuOpen;
                menu.classList.toggle('open', statusFilterMenuOpen);
            }

            function closeStatusFilterDropdown() {
                const menu = document.getElementById('statusFilterMenu');
                if (menu) {
                    menu.classList.remove('open');
                    statusFilterMenuOpen = false;
                }
            }

            function onStatusFilterChange() {
                // Update dropdown button text
                const checkboxes = document.querySelectorAll('input[name="statusFilter"]:checked');
                const selectedValues = Array.from(checkboxes).map(cb => cb.value);
                const textEl = document.querySelector('.multiselect-text');
                if (textEl) {
                    textEl.textContent = selectedValues.length > 0 ? selectedValues.join(', ') : 'Select...';
                }
                // Apply filter
                applyClientFilters();
            }

            // Close dropdown when clicking outside
            document.addEventListener('click', function(event) {
                const dropdown = document.getElementById('statusDropdown');
                if (dropdown && !dropdown.contains(event.target)) {
                    closeStatusFilterDropdown();
                }
            });

            // ========================================
            // Search Shortcuts (/, Cmd+F, Ctrl+F)
            // ========================================
            function focusSearchInput() {
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    // Expand filters panel if collapsed (narrow screen)
                    const filtersPanel = document.getElementById('filtersPanel');
                    if (filtersPanel && filtersPanel.classList.contains('collapsed')) {
                        filtersPanel.classList.remove('collapsed');
                        filtersCollapsed = false;
                    }
                    searchInput.focus();
                    searchInput.select();
                }
            }

            document.addEventListener('keydown', function(event) {
                // Skip if user is already typing in an input
                const activeElement = document.activeElement;
                const isTyping = activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.tagName === 'SELECT'
                );

                // "/" key - focus search when not typing
                if (event.key === '/' && !isTyping) {
                    event.preventDefault();
                    focusSearchInput();
                    return;
                }

                // Cmd+F (Mac) or Ctrl+F (Windows/Linux) - always focus search
                if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
                    event.preventDefault();
                    focusSearchInput();
                    return;
                }
            });

            // ========================================
            // Status Dropdown Functions
            // ========================================
            let currentOpenStatusMenu = null;

            function toggleStatusDropdown(event, issueId) {
                event.stopPropagation();

                const menu = document.getElementById('statusMenu-' + issueId);
                if (!menu) return;

                // Close any other open menu
                if (currentOpenStatusMenu && currentOpenStatusMenu !== menu) {
                    currentOpenStatusMenu.classList.remove('open');
                }

                // Toggle current menu
                const isOpen = menu.classList.toggle('open');
                currentOpenStatusMenu = isOpen ? menu : null;

                // Add click handlers to options
                if (isOpen) {
                    menu.querySelectorAll('.status-option').forEach(option => {
                        option.onclick = function(e) {
                            e.stopPropagation();
                            const statusName = this.getAttribute('data-status');
                            updateStatus(issueId, statusName);
                            menu.classList.remove('open');
                            currentOpenStatusMenu = null;
                        };
                    });
                }
            }

            function updateStatus(issueId, statusName) {
                // Find the status badge and show loading state
                const dropdown = document.querySelector('.status-dropdown[data-issue-id="' + issueId + '"]');
                const badge = dropdown?.querySelector('.status-badge');

                if (badge) {
                    badge.classList.add('status-updating');
                }

                vscode.postMessage({
                    command: 'updateStatus',
                    issueId: issueId,
                    statusName: statusName
                });
            }

            // Close dropdown when clicking outside
            document.addEventListener('click', function(event) {
                if (currentOpenStatusMenu && !event.target.closest('.status-dropdown')) {
                    currentOpenStatusMenu.classList.remove('open');
                    currentOpenStatusMenu = null;
                }
            });

            function openIssue(issueId) {
                vscode.postMessage({ command: 'openIssue', issueId });
            }

            function toggleCollapse(header) {
                const item = header.closest('.tree-item');
                if (item) {
                    item.classList.toggle('collapsed');
                }
            }

            function applyFilters() {
                const versionId = document.getElementById('versionFilter').value;
                const searchText = document.getElementById('searchInput').value;

                // ステータスチェックボックスの値を取得
                const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]:checked');
                const selectedStatuses = Array.from(statusCheckboxes).map(cb => cb.value);
                const includesClosed = selectedStatuses.includes('クローズ');

                vscode.postMessage({
                    command: 'filter',
                    versionId: versionId || undefined,
                    includeClosed: includesClosed,
                    searchText: searchText,
                    selectedStatuses: selectedStatuses
                });
            }

            function applyClientFilters() {
                const searchText = document.getElementById('searchInput').value;
                const assigneeId = document.getElementById('assigneeFilter').value;
                const trackerType = document.getElementById('trackerFilter').value;
                const hideEmptyCheckbox = document.getElementById('hideEmptyHierarchy');
                const hideEmptyHierarchy = hideEmptyCheckbox?.checked || false;

                // ステータスチェックボックスの値を取得
                const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]:checked');
                const selectedStatuses = Array.from(statusCheckboxes).map(cb => cb.value);

                filterByMultipleCriteria(searchText, assigneeId, trackerType, selectedStatuses, hideEmptyHierarchy);
            }

            function debounceSearch(value) {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    applyClientFilters();
                }, 300);
            }

            function filterByMultipleCriteria(searchText, assigneeId, trackerType, selectedStatuses, hideEmptyHierarchy) {
                const items = document.querySelectorAll('.tree-item');
                const searchLower = (searchText || '').toLowerCase();
                const defaultStatuses = ['未着手', '着手中'];
                const hasStatusFilter = selectedStatuses &&
                    (selectedStatuses.length !== defaultStatuses.length ||
                     !defaultStatuses.every(s => selectedStatuses.includes(s)));

                // Reset all items first
                items.forEach(item => {
                    item.classList.remove('search-hidden', 'search-match');
                });

                // Apply individual filters
                const hasFilters = searchText || assigneeId || trackerType || hasStatusFilter;

                if (hasFilters) {
                    items.forEach(item => {
                        let matches = true;

                        // Check search text
                        if (searchText) {
                            const subject = item.querySelector('.issue-subject');
                            const id = item.querySelector('.issue-id');
                            const text = (subject?.textContent || '') + ' ' + (id?.textContent || '');
                            if (!text.toLowerCase().includes(searchLower)) {
                                matches = false;
                            }
                        }

                        // Check assignee
                        if (matches && assigneeId) {
                            const assigneeElem = item.querySelector('.assignee');
                            const itemAssignee = assigneeElem?.textContent || '';
                            // Get selected assignee name from dropdown
                            const assigneeSelect = document.getElementById('assigneeFilter');
                            const selectedAssigneeName = assigneeSelect.options[assigneeSelect.selectedIndex]?.text || '';
                            if (!itemAssignee.includes(selectedAssigneeName.replace('@', ''))) {
                                matches = false;
                            }
                        }

                        // Check tracker type
                        if (matches && trackerType) {
                            const typeBadge = item.querySelector('.type-badge');
                            const itemType = typeBadge?.textContent?.trim() || '';
                            if (itemType.toLowerCase() !== trackerType.toLowerCase()) {
                                matches = false;
                            }
                        }

                        // Check status (マルチセレクト対応)
                        if (matches && selectedStatuses && selectedStatuses.length > 0) {
                            const statusBadge = item.querySelector('.status-badge');
                            const itemStatus = statusBadge?.textContent?.replace('▼', '').trim() || '';
                            if (!selectedStatuses.some(status => itemStatus.includes(status))) {
                                matches = false;
                            }
                        }

                        if (matches) {
                            item.classList.remove('search-hidden');
                            if (searchText) {
                                item.classList.add('search-match');
                            }
                            // Expand parent items
                            let parent = item.parentElement?.closest('.tree-item');
                            while (parent) {
                                parent.classList.remove('collapsed', 'search-hidden');
                                parent = parent.parentElement?.closest('.tree-item');
                            }
                        } else {
                            item.classList.add('search-hidden');
                            item.classList.remove('search-match');
                        }
                    });

                    // Show parent items that have visible children
                    items.forEach(item => {
                        if (item.classList.contains('search-hidden')) {
                            const hasVisibleChild = item.querySelector('.tree-item:not(.search-hidden)');
                            if (hasVisibleChild) {
                                item.classList.remove('search-hidden');
                            }
                        }
                    });
                }

                // 空の階層を非表示にする処理
                if (hideEmptyHierarchy) {
                    hideEmptyHierarchyItems();
                }
            }

            // フィルタ後にUserStoryを持たないEpic/Featureを非表示にする
            function hideEmptyHierarchyItems() {
                const items = document.querySelectorAll('.tree-item');

                // ボトムアップで処理（深い階層から順に）
                // まず全てのアイテムを配列に変換し、深さでソート
                const itemsArray = Array.from(items);

                // 各アイテムの深さを計算
                function getDepth(item) {
                    let depth = 0;
                    let parent = item.parentElement?.closest('.tree-item');
                    while (parent) {
                        depth++;
                        parent = parent.parentElement?.closest('.tree-item');
                    }
                    return depth;
                }

                // 深さでソート（深い順）
                itemsArray.sort((a, b) => getDepth(b) - getDepth(a));

                // 各アイテムについて、表示中のUserStoryがあるかチェック
                itemsArray.forEach(item => {
                    if (item.classList.contains('search-hidden')) return;

                    const typeBadge = item.querySelector(':scope > .tree-item-header .type-badge');
                    const itemType = typeBadge?.textContent?.trim().toLowerCase() || '';

                    // Epic または Feature の場合のみチェック
                    if (itemType === 'epic' || itemType === 'feature') {
                        // 直下または子孫に表示中のStory/Task/Bug/Testがあるか
                        const hasVisibleUserStoryOrDescendant = item.querySelector(
                            '.tree-item:not(.search-hidden) .type-badge'
                        );

                        if (!hasVisibleUserStoryOrDescendant) {
                            // 表示中の子要素がない場合は非表示
                            item.classList.add('search-hidden');
                        } else {
                            // 子要素がStory以下のタイプを含むかチェック
                            const childItems = item.querySelectorAll('.tree-item:not(.search-hidden)');
                            let hasStoryOrLeaf = false;
                            childItems.forEach(child => {
                                const childTypeBadge = child.querySelector(':scope > .tree-item-header .type-badge');
                                const childType = childTypeBadge?.textContent?.trim().toLowerCase() || '';
                                if (childType === 'story' || childType === 'task' || childType === 'bug' || childType === 'test') {
                                    hasStoryOrLeaf = true;
                                }
                            });
                            if (!hasStoryOrLeaf) {
                                item.classList.add('search-hidden');
                            }
                        }
                    }
                });
            }

            function clearAllFilters() {
                document.getElementById('searchInput').value = '';
                document.getElementById('versionFilter').value = '';
                document.getElementById('assigneeFilter').value = '';
                document.getElementById('trackerFilter').value = '';

                // ステータスチェックボックスをデフォルト状態にリセット（未着手と着手中をチェック）
                resetStatusFilterToDefault();

                // 空の階層を非表示チェックボックスをリセット（デフォルトOFF）
                const hideEmptyCheckbox = document.getElementById('hideEmptyHierarchy');
                if (hideEmptyCheckbox) hideEmptyCheckbox.checked = false;

                // Reset all items
                const items = document.querySelectorAll('.tree-item');
                items.forEach(item => {
                    item.classList.remove('search-hidden', 'search-match');
                });

                // Reapply server-side filters
                applyFilters();
            }

            function resetStatusFilterToDefault() {
                const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
                statusCheckboxes.forEach(cb => {
                    cb.checked = (cb.value === '未着手' || cb.value === '着手中');
                });
                // Update dropdown text
                const textEl = document.querySelector('.multiselect-text');
                if (textEl) {
                    textEl.textContent = '未着手, 着手中';
                }
            }

            function clearFilter(filterType) {
                switch(filterType) {
                    case 'search':
                        document.getElementById('searchInput').value = '';
                        applyClientFilters();
                        break;
                    case 'version':
                        document.getElementById('versionFilter').value = '';
                        applyFilters();
                        break;
                    case 'status':
                        resetStatusFilterToDefault();
                        applyClientFilters();
                        break;
                    case 'assignee':
                        document.getElementById('assigneeFilter').value = '';
                        applyClientFilters();
                        break;
                    case 'tracker':
                        document.getElementById('trackerFilter').value = '';
                        applyClientFilters();
                        break;
                    case 'hideEmpty':
                        const hideEmptyCheckbox = document.getElementById('hideEmptyHierarchy');
                        if (hideEmptyCheckbox) hideEmptyCheckbox.checked = false;
                        applyClientFilters();
                        break;
                }
            }

            function filterBySearch(searchText) {
                applyClientFilters();
            }

            // Expand all button
            function expandAll() {
                document.querySelectorAll('.tree-item').forEach(item => {
                    item.classList.remove('collapsed');
                });
            }

            // Collapse all button
            function collapseAll() {
                document.querySelectorAll('.tree-item').forEach(item => {
                    item.classList.add('collapsed');
                });
            }

            // ========================================
            // Issue Detail Toggle
            // ========================================
            let currentDetailIssueId = null;
            const detailCache = {};

            function toggleDetail(event, issueId) {
                event.stopPropagation();

                const item = document.querySelector('.tree-item[data-id="' + issueId + '"]');
                if (!item) return;

                const existingPanel = item.querySelector('.issue-detail-panel');

                // If clicking on the same issue, toggle the panel
                if (existingPanel) {
                    if (existingPanel.classList.contains('open')) {
                        existingPanel.classList.remove('open');
                        item.classList.remove('detail-open');
                        currentDetailIssueId = null;
                    } else {
                        // Close any other open panels
                        closeAllDetailPanels();
                        existingPanel.classList.add('open');
                        item.classList.add('detail-open');
                        currentDetailIssueId = issueId;
                    }
                    return;
                }

                // Close any other open panels
                closeAllDetailPanels();

                // Create new panel
                const panel = document.createElement('div');
                panel.className = 'issue-detail-panel open';
                panel.innerHTML = '<div class="detail-loading">Loading...</div>';

                // Insert after header
                const header = item.querySelector('.tree-item-header');
                if (header) {
                    header.insertAdjacentElement('afterend', panel);
                }

                item.classList.add('detail-open');
                currentDetailIssueId = issueId;

                // Check cache first
                if (detailCache[issueId]) {
                    renderDetailPanel(panel, detailCache[issueId]);
                } else {
                    // Request detail from extension
                    vscode.postMessage({ command: 'getIssueDetail', issueId: issueId });
                }
            }

            function closeAllDetailPanels() {
                document.querySelectorAll('.issue-detail-panel.open').forEach(panel => {
                    panel.classList.remove('open');
                });
                document.querySelectorAll('.tree-item.detail-open').forEach(item => {
                    item.classList.remove('detail-open');
                });
                currentDetailIssueId = null;
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;

                if (message.command === 'issueDetail') {
                    const panel = document.querySelector('.tree-item[data-id="' + message.issueId + '"] .issue-detail-panel');
                    if (panel) {
                        // Cache the result
                        detailCache[message.issueId] = message.detail;
                        renderDetailPanel(panel, message.detail);
                    }
                } else if (message.command === 'issueDetailError') {
                    const panel = document.querySelector('.tree-item[data-id="' + message.issueId + '"] .issue-detail-panel');
                    if (panel) {
                        panel.innerHTML = '<div class="detail-error">Error: ' + escapeHtml(message.error) + '</div>';
                    }
                } else if (message.command === 'commentSuccess') {
                    onCommentSuccess(message.issueId);
                } else if (message.command === 'commentError') {
                    onCommentError(message.issueId, message.error);
                } else if (message.command === 'statusUpdateSuccess') {
                    onStatusUpdateSuccess(message.issueId, message.newStatus);
                } else if (message.command === 'statusUpdateError') {
                    onStatusUpdateError(message.issueId, message.error);
                }
            });

            function onStatusUpdateSuccess(issueId, newStatus) {
                const dropdown = document.querySelector('.status-dropdown[data-issue-id="' + issueId + '"]');
                const badge = dropdown?.querySelector('.status-badge');

                if (badge) {
                    badge.classList.remove('status-updating');

                    // Update badge text (keep the arrow)
                    const arrow = badge.querySelector('.status-dropdown-arrow');
                    badge.innerHTML = escapeHtml(newStatus) + (arrow ? arrow.outerHTML : '<span class="status-dropdown-arrow">▼</span>');

                    // Update status class
                    badge.className = 'status-badge status-clickable ' + getStatusClassFromName(newStatus);
                }

                // Clear detail cache for this issue
                delete detailCache[issueId];
            }

            function onStatusUpdateError(issueId, errorMessage) {
                const dropdown = document.querySelector('.status-dropdown[data-issue-id="' + issueId + '"]');
                const badge = dropdown?.querySelector('.status-badge');

                if (badge) {
                    badge.classList.remove('status-updating');
                }

                // Show error notification
                alert('Failed to update status: ' + errorMessage);
            }

            function getStatusClassFromName(statusName) {
                const name = statusName.toLowerCase();
                if (name.includes('close') || name.includes('クローズ') || name.includes('完了')) {
                    return 'status-closed';
                }
                if (name.includes('progress') || name.includes('着手') || name.includes('進行')) {
                    return 'status-in-progress';
                }
                if (name.includes('review') || name.includes('レビュー')) {
                    return 'status-review';
                }
                if (name.includes('block') || name.includes('保留')) {
                    return 'status-blocked';
                }
                return 'status-open';
            }

            function renderDetailPanel(panel, detail) {
                const issue = detail.issue;
                const journals = detail.journals || [];
                const assignee = issue.assigned_to ? issue.assigned_to.name : 'Unassigned';
                const version = issue.fixed_version ? issue.fixed_version.name : 'None';
                const doneRatio = issue.done_ratio || 0;

                panel.innerHTML =
                    '<div class="detail-header">' +
                        '<div class="detail-info-item">' +
                            '<span class="detail-info-label">ID:</span>' +
                            '<span class="detail-info-value">#' + issue.id + '</span>' +
                        '</div>' +
                        '<div class="detail-info-item">' +
                            '<span class="detail-info-label">Status:</span>' +
                            '<span class="detail-info-value">' + escapeHtml(issue.status.name) + '</span>' +
                        '</div>' +
                        '<div class="detail-info-item">' +
                            '<span class="detail-info-label">Assignee:</span>' +
                            '<span class="detail-info-value">' + escapeHtml(assignee) + '</span>' +
                        '</div>' +
                        '<div class="detail-info-item">' +
                            '<span class="detail-info-label">Version:</span>' +
                            '<span class="detail-info-value">' + escapeHtml(version) + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="detail-progress">' +
                        '<div class="progress-text">Progress: ' + doneRatio + '%</div>' +
                        '<div class="progress-bar">' +
                            '<div class="progress-bar-fill" style="width: ' + doneRatio + '%"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="detail-description">' +
                        '<div class="detail-description-label">Description</div>' +
                        '<div class="detail-description-content">' + (issue.descriptionHtml || renderMarkdown(issue.description || '')) + '</div>' +
                    '</div>' +
                    '<div class="detail-comments">' +
                        '<div class="detail-comments-label">' +
                            'Comments & History' +
                            '<span class="comments-count">' + journals.length + '</span>' +
                        '</div>' +
                        '<div class="comments-list">' +
                            renderJournals(journals) +
                        '</div>' +
                    '</div>' +
                    '<div class="comment-input-section">' +
                        '<div class="comment-input-label">Add Comment</div>' +
                        '<div class="comment-input-wrapper">' +
                            '<textarea class="comment-textarea" id="commentInput-' + issue.id + '" placeholder="Enter your comment..."></textarea>' +
                            '<div class="comment-input-actions">' +
                                '<span class="comment-submit-success" id="commentSuccess-' + issue.id + '">&#10003; Comment added</span>' +
                                '<span class="comment-submit-error" id="commentError-' + issue.id + '"></span>' +
                                '<button class="comment-submit-btn" id="commentBtn-' + issue.id + '" onclick="submitComment(\\'' + issue.id + '\\')">Add</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="detail-actions">' +
                        '<button class="btn" onclick="openInBrowser(\\'' + escapeHtml(issue.url) + '\\')">Open in Browser</button>' +
                    '</div>';
            }

            function renderJournals(journals) {
                if (!journals || journals.length === 0) {
                    return '<div class="no-comments">No comments or changes</div>';
                }

                return journals.map(function(journal) {
                    const hasNotes = journal.notes && journal.notes.trim().length > 0;
                    const hasChanges = journal.details && journal.details.length > 0;

                    // Skip empty journals
                    if (!hasNotes && !hasChanges) {
                        return '';
                    }

                    const date = formatDate(journal.created_on);
                    const author = journal.user ? journal.user.name : 'Unknown';

                    let html = '<div class="comment-item">';
                    html += '<div class="comment-header">';
                    html += '<span class="comment-author">' + escapeHtml(author) + '</span>';
                    html += '<span class="comment-date">' + escapeHtml(date) + '</span>';
                    html += '</div>';

                    if (hasNotes) {
                        html += '<div class="comment-body">' + (journal.notesHtml || renderMarkdown(journal.notes)) + '</div>';
                    }

                    if (hasChanges) {
                        html += '<div class="comment-changes">';
                        journal.details.forEach(function(detail) {
                            html += renderChangeDetail(detail);
                        });
                        html += '</div>';
                    }

                    html += '</div>';
                    return html;
                }).join('');
            }

            function renderChangeDetail(detail) {
                const fieldName = getFieldDisplayName(detail.name);
                const oldVal = detail.old_value || '(none)';
                const newVal = detail.new_value || '(none)';

                return '<div class="change-item">' +
                    '<span class="change-label">' + escapeHtml(fieldName) + ':</span>' +
                    '<span class="change-old">' + escapeHtml(oldVal) + '</span>' +
                    '<span class="change-arrow">→</span>' +
                    '<span class="change-new">' + escapeHtml(newVal) + '</span>' +
                '</div>';
            }

            function getFieldDisplayName(fieldName) {
                const fieldMap = {
                    'status_id': 'Status',
                    'assigned_to_id': 'Assignee',
                    'fixed_version_id': 'Version',
                    'done_ratio': 'Progress',
                    'priority_id': 'Priority',
                    'tracker_id': 'Tracker',
                    'subject': 'Subject',
                    'description': 'Description',
                    'start_date': 'Start Date',
                    'due_date': 'Due Date',
                    'parent_id': 'Parent',
                    'estimated_hours': 'Estimated Hours'
                };
                return fieldMap[fieldName] || fieldName;
            }

            function formatDate(dateString) {
                if (!dateString) return '';
                const date = new Date(dateString);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
            }

            function openInBrowser(url) {
                vscode.postMessage({ command: 'openInBrowser', url: url });
            }

            // ========================================
            // Comment Submit
            // ========================================
            function submitComment(issueId) {
                const textarea = document.getElementById('commentInput-' + issueId);
                const btn = document.getElementById('commentBtn-' + issueId);
                const successMsg = document.getElementById('commentSuccess-' + issueId);
                const errorMsg = document.getElementById('commentError-' + issueId);

                if (!textarea || !btn) return;

                const comment = textarea.value.trim();
                if (!comment) {
                    errorMsg.textContent = 'Please enter a comment';
                    errorMsg.classList.add('show');
                    setTimeout(() => errorMsg.classList.remove('show'), 3000);
                    return;
                }

                // Reset messages
                successMsg.classList.remove('show');
                errorMsg.classList.remove('show');

                // Set loading state
                btn.disabled = true;
                btn.classList.add('loading');
                btn.textContent = '';

                vscode.postMessage({
                    command: 'addComment',
                    issueId: issueId,
                    comment: comment
                });
            }

            function onCommentSuccess(issueId) {
                const textarea = document.getElementById('commentInput-' + issueId);
                const btn = document.getElementById('commentBtn-' + issueId);
                const successMsg = document.getElementById('commentSuccess-' + issueId);
                const errorMsg = document.getElementById('commentError-' + issueId);

                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('loading');
                    btn.textContent = 'Add';
                }

                if (textarea) {
                    textarea.value = '';
                }

                if (successMsg) {
                    successMsg.classList.add('show');
                    setTimeout(() => successMsg.classList.remove('show'), 3000);
                }

                if (errorMsg) {
                    errorMsg.classList.remove('show');
                }

                // Clear cache and refresh detail
                delete detailCache[issueId];
                vscode.postMessage({ command: 'getIssueDetail', issueId: issueId });
            }

            function onCommentError(issueId, errorMessage) {
                const btn = document.getElementById('commentBtn-' + issueId);
                const errorMsg = document.getElementById('commentError-' + issueId);

                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('loading');
                    btn.textContent = 'Add';
                }

                if (errorMsg) {
                    errorMsg.textContent = errorMessage || 'Failed to add comment';
                    errorMsg.classList.add('show');
                }
            }

            // ========================================
            // Simple Markdown Renderer
            // ========================================
            function renderMarkdown(text) {
                if (!text) return '';

                let html = escapeHtml(text);

                // Code blocks (must come before inline code)
                html = html.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');

                // Inline code
                html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');

                // Headers
                html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
                html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
                html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

                // Bold
                html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');

                // Italic
                html = html.replace(/\\*(.+?)\\*/g, '<em>$1</em>');

                // Links
                html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank">$1</a>');

                // Blockquotes
                html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

                // Horizontal rule
                html = html.replace(/^---$/gm, '<hr>');

                // Unordered lists
                html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
                html = html.replace(/(<li>.*<\\/li>\\n?)+/g, '<ul>$&</ul>');

                // Line breaks (preserve paragraphs)
                html = html.replace(/\\n\\n/g, '</p><p>');
                html = html.replace(/\\n/g, '<br>');

                // Wrap in paragraph if not already wrapped
                if (!html.startsWith('<')) {
                    html = '<p>' + html + '</p>';
                }

                return html;
            }

            function escapeHtml(text) {
                if (!text) return '';
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
        `;
    }

    private getNotConfiguredHtml(): string {
        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
    <title>Epic Ladder</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background: var(--vscode-editor-background);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .message {
            text-align: center;
            padding: 32px;
        }
        .icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        h2 {
            margin-bottom: 8px;
        }
        p {
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="message">
        <div class="icon">&#9881;</div>
        <h2>Redmine Settings Required</h2>
        <p>Please configure Redmine URL and API Key in settings.</p>
    </div>
</body>
</html>`;
    }

    private getErrorHtml(message: string): string {
        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
    <title>Epic Ladder - Error</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background: var(--vscode-editor-background);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .message {
            text-align: center;
            padding: 32px;
            max-width: 400px;
        }
        .icon {
            font-size: 48px;
            margin-bottom: 16px;
            color: var(--vscode-errorForeground);
        }
        h2 {
            margin-bottom: 8px;
            color: var(--vscode-errorForeground);
        }
        p {
            opacity: 0.8;
            word-break: break-word;
        }
    </style>
</head>
<body>
    <div class="message">
        <div class="icon">&#9888;</div>
        <h2>Error Loading Data</h2>
        <p>${this.escapeHtml(message)}</p>
    </div>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    private extractAssignees(structure: ProjectStructureEpic[]): AssigneeInfo[] {
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

    private countActiveFilters(filterOptions?: FilterOptions, defaultStatuses?: string[]): number {
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

    private renderActiveFilterBadges(
        filterOptions: FilterOptions | undefined,
        versions: RedmineVersion[],
        assignees: AssigneeInfo[],
        defaultStatuses?: string[]
    ): string {
        if (!filterOptions) return '';
        const badges: string[] = [];

        if (filterOptions.searchText) {
            badges.push(`<span class="active-filter-badge" data-filter="search">
                Search: "${this.escapeHtml(filterOptions.searchText)}"
                <span class="remove-filter" onclick="clearFilter('search')">×</span>
            </span>`);
        }
        if (filterOptions.versionId) {
            const version = versions.find(v => v.id === filterOptions.versionId);
            badges.push(`<span class="active-filter-badge" data-filter="version">
                Version: ${this.escapeHtml(version?.name || filterOptions.versionId)}
                <span class="remove-filter" onclick="clearFilter('version')">×</span>
            </span>`);
        }
        // ステータスフィルタ: デフォルトと異なる場合に表示
        if (filterOptions.selectedStatuses && defaultStatuses) {
            const isDefault = filterOptions.selectedStatuses.length === defaultStatuses.length &&
                defaultStatuses.every(s => filterOptions.selectedStatuses!.includes(s));
            if (!isDefault) {
                const statusText = filterOptions.selectedStatuses.join(', ');
                badges.push(`<span class="active-filter-badge" data-filter="status">
                    Status: ${this.escapeHtml(statusText)}
                    <span class="remove-filter" onclick="clearFilter('status')">×</span>
                </span>`);
            }
        }
        if (filterOptions.assigneeId) {
            const assignee = assignees.find(a => a.id === filterOptions.assigneeId);
            badges.push(`<span class="active-filter-badge" data-filter="assignee">
                Assignee: ${this.escapeHtml(assignee?.name || filterOptions.assigneeId)}
                <span class="remove-filter" onclick="clearFilter('assignee')">×</span>
            </span>`);
        }
        if (filterOptions.trackerType) {
            badges.push(`<span class="active-filter-badge" data-filter="tracker">
                Type: ${this.escapeHtml(filterOptions.trackerType)}
                <span class="remove-filter" onclick="clearFilter('tracker')">×</span>
            </span>`);
        }
        if (filterOptions.hideEmptyHierarchy) {
            badges.push(`<span class="active-filter-badge" data-filter="hideEmpty">
                空の階層を非表示
                <span class="remove-filter" onclick="clearFilter('hideEmpty')">×</span>
            </span>`);
        }

        return badges.join('');
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    dispose(): void {
        this.panel?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}

interface FilterOptions {
    versionId?: string;
    includeClosed?: boolean;
    searchText?: string;
    assigneeId?: string;
    trackerType?: string;
    selectedStatuses?: string[];  // マルチセレクト対応: 選択されたステータス名の配列
    hideEmptyHierarchy?: boolean;  // フィルタ後にUSがないEpic/Featureを非表示
}

interface AssigneeInfo {
    id: string;
    name: string;
}
