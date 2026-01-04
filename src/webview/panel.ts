/**
 * Main webview panel class for Epic Ladder
 */
import * as vscode from 'vscode';
import { McpClient } from '../mcpClient';
import {
    GetProjectStructureResponse,
    ProjectStructureEpic,
    RedmineVersion,
    RedmineStatusItem,
    RedmineMember
} from '../types';
import { getStyles } from './styles';
import { getScript } from './scripts';
import {
    renderEpics,
    renderActiveFilterBadges,
    getNotConfiguredHtml,
    getErrorHtml,
    FilterOptions,
    AssigneeInfo,
    getStatusClass
} from './renderers';
import {
    renderMarkdownToHtml,
    escapeHtml,
    countActiveFilters,
    getNonce
} from './utils';

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
            case 'openIssueInBrowser':
                if (typeof message.issueId === 'string' && this.mcpClient) {
                    try {
                        const detail = await this.mcpClient.getIssueDetail(message.issueId);
                        if (detail.issue?.url) {
                            await vscode.env.openExternal(vscode.Uri.parse(detail.issue.url));
                        }
                    } catch (error) {
                        console.error('Failed to get issue detail:', error);
                    }
                }
                break;
            case 'copyIssueUrl':
                if (typeof message.issueId === 'string' && this.mcpClient) {
                    try {
                        const detail = await this.mcpClient.getIssueDetail(message.issueId);
                        if (detail.issue?.url) {
                            this.panel?.webview.postMessage({
                                command: 'copyIssueUrlReady',
                                issueId: message.issueId,
                                url: detail.issue.url
                            });
                        }
                    } catch (error) {
                        console.error('Failed to get issue detail for copy:', error);
                    }
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
                            issueId: message.issueId,
                            fromModal: message.fromModal || false
                        });
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        this.panel?.webview.postMessage({
                            command: 'commentError',
                            issueId: message.issueId,
                            error: errorMessage,
                            fromModal: message.fromModal || false
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
                            newStatus: result.new_status,
                            statusClass: getStatusClass({ name: result.new_status })
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
            case 'updateAssignee':
                if (typeof message.issueId === 'string' && this.mcpClient) {
                    try {
                        const assigneeId = message.assigneeId === '' ? null : message.assigneeId as string;
                        const result = await this.mcpClient.updateIssueAssignee(
                            message.issueId,
                            assigneeId
                        );
                        this.panel?.webview.postMessage({
                            command: 'assigneeUpdateSuccess',
                            issueId: message.issueId,
                            newAssignee: result.new_assignee,
                            newAssigneeId: message.assigneeId
                        });
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        this.panel?.webview.postMessage({
                            command: 'assigneeUpdateError',
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
            this.panel.webview.html = getNotConfiguredHtml();
            return;
        }

        try {
            const [structureResponse, versionsResponse, statusesResponse, membersResponse] = await Promise.all([
                this.mcpClient.getProjectStructure({
                    max_depth: 4,
                    include_closed: filterOptions?.includeClosed ?? false,
                    version_id: filterOptions?.versionId
                }),
                this.mcpClient.listVersions({ status: 'all' }),
                this.mcpClient.listStatuses({ include_closed: true }),
                this.mcpClient.listProjectMembers({})
            ]);

            this.panel.webview.html = this.getWebviewContent(
                structureResponse,
                versionsResponse.versions,
                statusesResponse.statuses,
                membersResponse.members,
                filterOptions
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.panel.webview.html = getErrorHtml(message);
        }
    }

    private getWebviewContent(
        structure: GetProjectStructureResponse,
        versions: RedmineVersion[],
        statuses: RedmineStatusItem[],
        members: RedmineMember[],
        filterOptions?: FilterOptions
    ): string {
        const nonce = getNonce();
        // 言語判定（日本語 or その他）
        const isJa = vscode.env.language.startsWith('ja');
        const i18n = {
            searchPlaceholder: isJa ? '🔍 検索 (#でID指定)' : '🔍 Search (#ID)',
            filters: 'Filters',
            hideEmptyHierarchy: isJa ? '空の階層を非表示' : 'Hide empty hierarchy',
            allVersions: 'All Versions',
            allAssignees: 'All Assignees',
            allTypes: 'All Types',
            clearFilters: 'Clear Filters',
        };
        // メンバー一覧をAssigneeInfo形式に変換
        const assignees: AssigneeInfo[] = members.map(m => ({
            id: m.user_id,
            name: m.name
        }));
        const trackerTypes = ['Epic', 'Feature', 'Story', 'Task', 'Bug', 'Test'];
        // ステータス一覧を動的に取得
        const statusTypes = statuses.map(s => s.name);
        // デフォルト: クローズ以外を選択（Open Only相当）
        const defaultStatuses = statuses.filter(s => !s.is_closed).map(s => s.name);
        const selectedStatuses = filterOptions?.selectedStatuses ?? defaultStatuses;
        const activeFilterCount = countActiveFilters(filterOptions, defaultStatuses);

        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>Epic Ladder</title>
    <style>
        ${getStyles()}
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

            <!-- Unified filter bar for narrow width -->
            <div class="unified-filter-bar" id="unifiedFilterBar">
                <input type="text" class="unified-search-input" id="unifiedSearchInput"
                    placeholder="${i18n.searchPlaceholder}"
                    value="${filterOptions?.searchText ?? ''}"
                    oninput="onUnifiedSearchInput(this.value)">
                <button class="unified-filter-btn ${activeFilterCount > 0 ? 'active' : ''}" onclick="toggleFilters()" title="${i18n.filters}">
                    <span class="unified-filter-icon">⚙</span>
                    <span>${i18n.filters}</span>
                    ${activeFilterCount > 0 ? `<span class="filter-badge">${activeFilterCount}</span>` : ''}
                </button>
                <button class="unified-clear-btn" onclick="clearAllFilters()" title="Clear all">✕</button>
                <button class="unified-reload-btn" onclick="refresh()" title="Reload (Cmd+R)">↻</button>
            </div>

            <!-- Old filter toggle (hidden, replaced by unified bar) -->
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
                    <div class="filter-group filter-group-search">
                        <label for="searchInput">Search</label>
                        <input type="text" id="searchInput" placeholder="${isJa ? '検索 (#でID指定)' : 'Search (#ID)'}"
                            value="${filterOptions?.searchText ?? ''}"
                            oninput="debounceSearch(this.value)">
                    </div>
                    <div class="filter-group filter-group-version">
                        <label for="versionFilter">Version</label>
                        <select id="versionFilter" onchange="applyFilters()">
                            <option value="">${i18n.allVersions}</option>
                            ${versions.map(v => `
                                <option value="${v.id}" ${filterOptions?.versionId === v.id ? 'selected' : ''}>
                                    ${escapeHtml(v.name)}
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
                                        <input type="checkbox" name="statusFilter" value="${escapeHtml(status)}"
                                            ${selectedStatuses.includes(status) ? 'checked' : ''}
                                            onchange="onStatusFilterChange()">
                                        <span>${escapeHtml(status)}</span>
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
                            <option value="">${i18n.allAssignees}</option>
                            ${assignees.map(a => `
                                <option value="${a.id}" ${filterOptions?.assigneeId === a.id ? 'selected' : ''}>
                                    ${escapeHtml(a.name)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="trackerFilter">Type</label>
                        <select id="trackerFilter" onchange="applyClientFilters()">
                            <option value="">${i18n.allTypes}</option>
                            ${trackerTypes.map(t => `
                                <option value="${t}" ${filterOptions?.trackerType === t ? 'selected' : ''}>
                                    ${t}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="sortOrder">Sort</label>
                        <select id="sortOrder" onchange="applySorting()">
                            <option value="id_asc" ${(filterOptions as Record<string, unknown>)?.sortOrder === 'id_asc' ? 'selected' : ''}>ID ↑</option>
                            <option value="id_desc" ${(filterOptions as Record<string, unknown>)?.sortOrder === 'id_desc' ? 'selected' : ''}>ID ↓</option>
                            <option value="name_asc" ${(filterOptions as Record<string, unknown>)?.sortOrder === 'name_asc' ? 'selected' : ''}>${isJa ? '名前' : 'Name'} ↑</option>
                            <option value="name_desc" ${(filterOptions as Record<string, unknown>)?.sortOrder === 'name_desc' ? 'selected' : ''}>${isJa ? '名前' : 'Name'} ↓</option>
                            <option value="version_asc" ${(filterOptions as Record<string, unknown>)?.sortOrder === 'version_asc' ? 'selected' : ''}>${isJa ? '期日' : 'Due'} ↑</option>
                            <option value="version_desc" ${(filterOptions as Record<string, unknown>)?.sortOrder === 'version_desc' ? 'selected' : ''}>${isJa ? '期日' : 'Due'} ↓</option>
                        </select>
                    </div>
                    <div class="filter-group filter-checkbox">
                        <label class="inline-checkbox">
                            <input type="checkbox" id="hideEmptyHierarchy"
                                ${filterOptions?.hideEmptyHierarchy !== false ? 'checked' : ''}
                                onchange="applyClientFilters()">
                            <span>${i18n.hideEmptyHierarchy}</span>
                        </label>
                    </div>
                    <div class="filter-group filter-actions">
                        <label>&nbsp;</label>
                        <button class="btn btn-clear" onclick="clearAllFilters()" title="${i18n.clearFilters}">
                            ${i18n.clearFilters}
                        </button>
                    </div>
                </div>
                ${activeFilterCount > 0 ? `
                    <div class="active-filters">
                        <span class="active-filters-label">Active:</span>
                        ${renderActiveFilterBadges(filterOptions, versions, assignees, defaultStatuses, { hideEmptyHierarchy: i18n.hideEmptyHierarchy })}
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
                ${renderEpics(structure.structure, statusTypes, assignees, versions)}
            </div>
        </div>
    </div>

    <!-- Issue Detail Modal -->
    <div class="modal-overlay" id="commentsModal" onclick="if(event.target === this) closeCommentsModal()">
        <div class="modal-container">
            <div class="modal-header">
                <div class="modal-title">
                    Issue Detail
                </div>
                <button class="modal-close-btn" onclick="closeCommentsModal()" title="Close (Esc)">×</button>
            </div>
            <div class="modal-body">
                <div class="modal-comments-list" id="modalCommentsList">
                    <div class="detail-loading">Loading...</div>
                </div>
            </div>
            <div class="modal-footer">
                <div class="modal-comment-input-wrapper">
                    <textarea class="modal-comment-textarea" id="modalCommentInput" placeholder="Enter your comment..."></textarea>
                    <div class="modal-comment-actions">
                        <span class="comment-submit-success" id="modalCommentSuccess">&#10003; Comment added</span>
                        <span class="comment-submit-error" id="modalCommentError"></span>
                        <button class="comment-submit-btn" id="modalCommentBtn" onclick="submitModalComment()">Add Comment</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        // Global data for modal dropdowns
        const globalMembers = ${JSON.stringify(assignees)};
        const globalStatuses = ${JSON.stringify(statusTypes)};
        // デフォルトステータス（クローズ以外）- サーバーで動的生成
        const globalDefaultStatuses = ${JSON.stringify(defaultStatuses)};

        ${getScript()}
    </script>
</body>
</html>`;
    }

    dispose(): void {
        this.panel?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
