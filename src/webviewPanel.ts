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

        <div class="filters">
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
                <div class="tree-item-header" onclick="toggleCollapse(this)">
                    <span class="collapse-icon">&#9662;</span>
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
                <div class="tree-item-header" onclick="toggleCollapse(this)">
                    <span class="collapse-icon">&#9662;</span>
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

            return `
                <div class="tree-item tree-item-story" data-id="${story.id}">
                    <div class="tree-item-header ${hasChildren ? '' : 'no-children'}" onclick="${hasChildren ? 'toggleCollapse(this)' : ''}">
                        ${hasChildren ? '<span class="collapse-icon">&#9662;</span>' : '<span class="collapse-icon-placeholder"></span>'}
                        <span class="type-badge badge-story">Story</span>
                        <span class="status-badge ${this.getStatusClass(story.status)}">${this.escapeHtml(story.status.name)}</span>
                        <span class="issue-id" onclick="event.stopPropagation(); openIssue('${story.id}')">#${story.id}</span>
                        <span class="issue-subject">${this.escapeHtml(story.subject)}</span>
                        ${story.assigned_to ? `<span class="assignee">@${this.escapeHtml(story.assigned_to.name)}</span>` : ''}
                        ${story.version ? `<span class="version">${this.escapeHtml(story.version.name)}</span>` : ''}
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
        return `
            <div class="tree-item tree-item-leaf" data-id="${item.id}">
                <div class="tree-item-header no-children">
                    <span class="collapse-icon-placeholder"></span>
                    <span class="type-badge ${badgeClass}">${type}</span>
                    <span class="status-badge ${this.getStatusClass(item.status)}">${this.escapeHtml(item.status.name)}</span>
                    <span class="issue-id" onclick="openIssue('${item.id}')">#${item.id}</span>
                    <span class="issue-subject">${this.escapeHtml(item.subject)}</span>
                    ${item.assigned_to ? `<span class="assignee">@${this.escapeHtml(item.assigned_to.name)}</span>` : ''}
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
                padding: 16px;
                line-height: 1.5;
            }

            .container {
                max-width: 100%;
            }

            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--border-color);
            }

            .header h1 {
                font-size: 1.4em;
                font-weight: 600;
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

            .filters {
                display: flex;
                gap: 16px;
                flex-wrap: wrap;
                margin-bottom: 16px;
                padding: 12px;
                background: var(--vscode-sideBar-background);
                border-radius: 6px;
            }

            .filter-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .filter-group label {
                font-size: 11px;
                text-transform: uppercase;
                opacity: 0.8;
            }

            .filter-group input,
            .filter-group select {
                background: var(--input-bg);
                color: var(--text-color);
                border: 1px solid var(--input-border);
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 13px;
                min-width: 150px;
            }

            .filter-group input:focus,
            .filter-group select:focus {
                outline: 1px solid var(--vscode-focusBorder);
            }

            .summary {
                display: flex;
                gap: 16px;
                flex-wrap: wrap;
                margin-bottom: 16px;
                padding: 8px 0;
            }

            .summary-item {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
            }

            .badge {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 11px;
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
                gap: 8px;
                padding: 8px 12px;
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
                text-align: center;
            }

            .collapse-icon-placeholder {
                width: 12px;
            }

            .tree-item.collapsed .collapse-icon {
                transform: rotate(-90deg);
            }

            .tree-item.collapsed > .tree-children {
                display: none;
            }

            .tree-children {
                padding-left: 24px;
                border-top: 1px solid var(--border-color);
            }

            .type-badge {
                font-size: 10px;
                padding: 1px 6px;
                border-radius: 4px;
                font-weight: 500;
            }

            .status-badge {
                font-size: 10px;
                padding: 1px 6px;
                border-radius: 4px;
            }

            .status-open { background: var(--vscode-statusBarItem-warningBackground); color: var(--vscode-statusBarItem-warningForeground); }
            .status-in-progress { background: #3b82f6; color: #fff; }
            .status-review { background: #a855f7; color: #fff; }
            .status-blocked { background: #f97316; color: #000; }
            .status-closed { background: #22c55e; color: #000; }

            .issue-id {
                font-family: monospace;
                font-size: 12px;
                color: var(--vscode-textLink-foreground);
                cursor: pointer;
            }

            .issue-id:hover {
                text-decoration: underline;
            }

            .issue-subject {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .assignee {
                font-size: 11px;
                opacity: 0.7;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 1px 6px;
                border-radius: 4px;
            }

            .version {
                font-size: 11px;
                opacity: 0.7;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 1px 6px;
                border-radius: 4px;
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
        `;
    }

    private getScript(): string {
        return `
            const vscode = acquireVsCodeApi();
            let searchTimeout;

            function refresh() {
                vscode.postMessage({ command: 'refresh' });
            }

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
