import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import {
    GetProjectStructureResponse,
    ProjectStructureEpic,
    RedmineVersion,
    RedmineIssue
} from './types';

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
                await this.updateContent();
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
                        this.panel?.webview.postMessage({
                            command: 'issueDetail',
                            issueId: message.issueId,
                            detail: detail
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

        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Epic Ladder</title>
    <style>
        ${this.getStyles()}
    </style>
</head>
<body>
    <div class="container">
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
        </button>

        <div class="filters" id="filtersPanel">
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
            <div class="filter-group">
                <label for="statusFilter">Status</label>
                <select id="statusFilter" onchange="applyFilters()">
                    <option value="open" ${!filterOptions?.includeClosed ? 'selected' : ''}>Open Only</option>
                    <option value="all" ${filterOptions?.includeClosed ? 'selected' : ''}>All</option>
                </select>
            </div>
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

        <div class="tree-container" id="treeContainer">
            ${this.renderEpics(structure.structure)}
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
                    <span class="status-badge ${this.getStatusClass(epic.status)}">${this.escapeHtml(epic.status.name)}</span>
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
                    <span class="status-badge ${this.getStatusClass(feature.status)}">${this.escapeHtml(feature.status.name)}</span>
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
                        <span class="status-badge ${this.getStatusClass(story.status)}">${this.escapeHtml(story.status.name)}</span>
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
                    <span class="status-badge ${this.getStatusClass(item.status)}">${this.escapeHtml(item.status.name)}</span>
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

            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--text-color);
                background: var(--bg-color);
                padding: 12px;
                line-height: 1.5;
            }

            .container {
                max-width: 100%;
                container-type: inline-size;
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

            .filters {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
                margin-bottom: 12px;
                padding: 12px;
                background: var(--vscode-sideBar-background);
                border-radius: 6px;
            }

            .filters.collapsed {
                display: none;
            }

            .filter-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
                flex: 1;
                min-width: 120px;
            }

            .filter-group label {
                font-size: 10px;
                text-transform: uppercase;
                opacity: 0.8;
            }

            .filter-group input,
            .filter-group select {
                background: var(--input-bg);
                color: var(--text-color);
                border: 1px solid var(--input-border);
                padding: 6px 8px;
                border-radius: 4px;
                font-size: 13px;
                width: 100%;
            }

            .filter-group input:focus,
            .filter-group select:focus {
                outline: 1px solid var(--vscode-focusBorder);
            }

            .summary {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 12px;
                padding: 8px;
                background: var(--vscode-sideBar-background);
                border-radius: 6px;
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
                body {
                    padding: 8px;
                }

                :root {
                    --indent-size: 10px;
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
                    flex-direction: column;
                    gap: 8px;
                    padding: 10px;
                    margin-bottom: 8px;
                }

                .filter-group {
                    min-width: unset;
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
                vscode.postMessage({ command: 'refresh' });
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
                const statusFilter = document.getElementById('statusFilter').value;
                const searchText = document.getElementById('searchInput').value;

                vscode.postMessage({
                    command: 'filter',
                    versionId: versionId || undefined,
                    includeClosed: statusFilter === 'all',
                    searchText: searchText
                });
            }

            function debounceSearch(value) {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    filterBySearch(value);
                }, 300);
            }

            function filterBySearch(searchText) {
                const items = document.querySelectorAll('.tree-item');
                const searchLower = searchText.toLowerCase();

                if (!searchText) {
                    items.forEach(item => {
                        item.classList.remove('search-hidden', 'search-match');
                    });
                    return;
                }

                items.forEach(item => {
                    const subject = item.querySelector('.issue-subject');
                    const id = item.querySelector('.issue-id');
                    const text = (subject?.textContent || '') + ' ' + (id?.textContent || '');

                    if (text.toLowerCase().includes(searchLower)) {
                        item.classList.remove('search-hidden');
                        item.classList.add('search-match');
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
                }
            });

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
                        '<div class="detail-description-content">' + renderMarkdown(issue.description || '') + '</div>' +
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
                        html += '<div class="comment-body">' + renderMarkdown(journal.notes) + '</div>';
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
}
