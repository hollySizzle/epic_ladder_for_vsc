/**
 * Main webview panel class for Epic Ladder
 */
import * as vscode from 'vscode';
import { McpClient } from '../mcpClient';
import {
    GetProjectStructureResponse,
    ProjectStructureEpic,
    RedmineVersion
} from '../types';
import { getStyles } from './styles';
import { getScript } from './scripts';
import {
    renderEpics,
    renderActiveFilterBadges,
    getNotConfiguredHtml,
    getErrorHtml,
    FilterOptions,
    AssigneeInfo
} from './renderers';
import {
    renderMarkdownToHtml,
    escapeHtml,
    extractAssignees,
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
            this.panel.webview.html = getNotConfiguredHtml();
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
            this.panel.webview.html = getErrorHtml(message);
        }
    }

    private getWebviewContent(
        structure: GetProjectStructureResponse,
        versions: RedmineVersion[],
        filterOptions?: FilterOptions
    ): string {
        const nonce = getNonce();
        const assignees = extractAssignees(structure.structure);
        const trackerTypes = ['Epic', 'Feature', 'Story', 'Task', 'Bug', 'Test'];
        const statusTypes = ['未着手', '着手中', 'クローズ'];
        // デフォルト: 未着手と着手中を選択（Open Only相当）
        const defaultStatuses = ['未着手', '着手中'];
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
                            <option value="">All Assignees</option>
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
                        ${renderActiveFilterBadges(filterOptions, versions, assignees, defaultStatuses)}
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
                ${renderEpics(structure.structure)}
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
