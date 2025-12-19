/**
 * HTML rendering functions for the Epic Ladder webview
 */
import { ProjectStructureEpic, RedmineVersion } from '../types';
import { escapeHtml } from './utils';

export interface FilterOptions {
    versionId?: string;
    includeClosed?: boolean;
    searchText?: string;
    assigneeId?: string;
    trackerType?: string;
    selectedStatuses?: string[];
    hideEmptyHierarchy?: boolean;
}

export interface AssigneeInfo {
    id: string;
    name: string;
}

/**
 * Render all epics as HTML tree
 */
export function renderEpics(epics: ProjectStructureEpic[], statusOptions: string[], members: AssigneeInfo[] = []): string {
    if (!epics || epics.length === 0) {
        return '<div class="empty-state">No epics found</div>';
    }

    return epics.map(epic => `
        <div class="tree-item tree-item-epic" data-id="${epic.id}">
            <div class="tree-item-header" onclick="toggleDetail(event, '${epic.id}')">
                <span class="collapse-icon" onclick="event.stopPropagation(); toggleCollapse(this.parentElement)">&#9662;</span>
                <span class="type-badge badge-epic">Epic</span>
                ${renderStatusBadge(epic.id, epic.status, statusOptions)}
                <span class="issue-id" onclick="event.stopPropagation(); openIssueInBrowser('${epic.id}')">#${epic.id}</span>
                <span class="copy-url-btn" onclick="event.stopPropagation(); copyIssueUrl('${epic.id}')" title="Copy URL">Copy</span>
                <span class="issue-subject">${escapeHtml(epic.subject)}</span>
            </div>
            <div class="tree-children">
                ${renderFeatures(epic.features, statusOptions, members)}
            </div>
        </div>
    `).join('');
}

/**
 * Render features as HTML tree
 */
export function renderFeatures(features: ProjectStructureEpic['features'], statusOptions: string[], members: AssigneeInfo[] = []): string {
    if (!features || features.length === 0) {
        return '';
    }

    return features.map(feature => `
        <div class="tree-item tree-item-feature" data-id="${feature.id}">
            <div class="tree-item-header" onclick="toggleDetail(event, '${feature.id}')">
                <span class="collapse-icon" onclick="event.stopPropagation(); toggleCollapse(this.parentElement)">&#9662;</span>
                <span class="type-badge badge-feature">Feature</span>
                ${renderStatusBadge(feature.id, feature.status, statusOptions)}
                <span class="issue-id" onclick="event.stopPropagation(); openIssueInBrowser('${feature.id}')">#${feature.id}</span>
                <span class="copy-url-btn" onclick="event.stopPropagation(); copyIssueUrl('${feature.id}')" title="Copy URL">Copy</span>
                <span class="issue-subject">${escapeHtml(feature.subject)}</span>
            </div>
            <div class="tree-children">
                ${renderUserStories(feature.user_stories, statusOptions, members)}
            </div>
        </div>
    `).join('');
}

/**
 * Render user stories as HTML tree
 */
export function renderUserStories(stories: ProjectStructureEpic['features'][0]['user_stories'], statusOptions: string[], members: AssigneeInfo[] = []): string {
    if (!stories || stories.length === 0) {
        return '';
    }

    return stories.map(story => {
        const hasChildren = story.children && (
            story.children.tasks.length > 0 ||
            story.children.bugs.length > 0 ||
            story.children.tests.length > 0
        );

        const versionInfo = story.version ? `<span class="version">${escapeHtml(story.version.name)}</span>` : '';

        return `
            <div class="tree-item tree-item-story" data-id="${story.id}">
                <div class="tree-item-header ${hasChildren ? '' : 'no-children'}" onclick="toggleDetail(event, '${story.id}')">
                    ${hasChildren ? `<span class="collapse-icon" onclick="event.stopPropagation(); toggleCollapse(this.parentElement)">&#9662;</span>` : '<span class="collapse-icon-placeholder"></span>'}
                    <span class="type-badge badge-story">Story</span>
                    ${renderStatusBadge(story.id, story.status, statusOptions)}
                    ${renderAssigneeBadge(story.id, story.assigned_to, members)}
                    <span class="issue-id" onclick="event.stopPropagation(); openIssueInBrowser('${story.id}')">#${story.id}</span>
                    <span class="copy-url-btn" onclick="event.stopPropagation(); copyIssueUrl('${story.id}')" title="Copy URL">Copy</span>
                    <span class="issue-subject">${escapeHtml(story.subject)}</span>
                    ${versionInfo ? `<div class="meta-info">${versionInfo}</div>` : ''}
                </div>
                ${hasChildren ? `
                    <div class="tree-children">
                        ${renderChildren(story.children!, statusOptions, members)}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Render children (tasks, bugs, tests) as HTML
 */
export function renderChildren(children: NonNullable<ProjectStructureEpic['features'][0]['user_stories'][0]['children']>, statusOptions: string[], members: AssigneeInfo[] = []): string {
    const items: string[] = [];

    children.tasks.forEach(task => {
        items.push(renderLeafItem(task, 'Task', 'badge-task', statusOptions, members));
    });

    children.bugs.forEach(bug => {
        items.push(renderLeafItem(bug, 'Bug', 'badge-bug', statusOptions, members));
    });

    children.tests.forEach(test => {
        items.push(renderLeafItem(test, 'Test', 'badge-test', statusOptions, members));
    });

    return items.join('');
}

/**
 * Render a leaf item (task, bug, or test)
 */
export function renderLeafItem(
    item: { id: string; subject: string; status: { name: string; is_closed: boolean }; assigned_to?: { id: string; name: string } },
    type: string,
    badgeClass: string,
    statusOptions: string[],
    members: AssigneeInfo[] = []
): string {
    return `
        <div class="tree-item tree-item-leaf" data-id="${item.id}">
            <div class="tree-item-header no-children" onclick="toggleDetail(event, '${item.id}')">
                <span class="collapse-icon-placeholder"></span>
                <span class="type-badge ${badgeClass}">${type}</span>
                ${renderStatusBadge(item.id, item.status, statusOptions)}
                ${renderAssigneeBadge(item.id, item.assigned_to, members)}
                <span class="issue-id" onclick="event.stopPropagation(); openIssueInBrowser('${item.id}')">#${item.id}</span>
                <span class="copy-url-btn" onclick="event.stopPropagation(); copyIssueUrl('${item.id}')" title="Copy URL">Copy</span>
                <span class="issue-subject">${escapeHtml(item.subject)}</span>
            </div>
        </div>
    `;
}

/**
 * Get CSS class for status
 */
export function getStatusClass(status: { name: string; is_closed: boolean }): string {
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

/**
 * Render a status badge with dropdown
 */
export function renderStatusBadge(issueId: string, status: { name: string; is_closed: boolean }, statusOptions: string[]): string {
    const optionsHtml = statusOptions.map(opt =>
        `<div class="status-option" data-status="${escapeHtml(opt)}">${escapeHtml(opt)}</div>`
    ).join('');

    return `
        <div class="status-dropdown" data-issue-id="${issueId}">
            <span class="status-badge status-clickable ${getStatusClass(status)}"
                  onclick="event.stopPropagation(); toggleStatusDropdown(event, '${issueId}')">
                ${escapeHtml(status.name)}
                <span class="status-dropdown-arrow">▼</span>
            </span>
            <div class="status-dropdown-menu" id="statusMenu-${issueId}">
                ${optionsHtml}
            </div>
        </div>
    `;
}

/**
 * Render an assignee badge with dropdown
 */
export function renderAssigneeBadge(
    issueId: string,
    assignedTo: { id: string; name: string } | undefined,
    members: AssigneeInfo[]
): string {
    const assigneeName = assignedTo?.name ?? 'Unassigned';
    const assigneeId = assignedTo?.id ?? '';

    const optionsHtml = [
        `<div class="assignee-option" data-assignee-id="" data-assignee-name="Unassigned">Unassigned</div>`,
        ...members.map(m =>
            `<div class="assignee-option" data-assignee-id="${escapeHtml(m.id)}" data-assignee-name="${escapeHtml(m.name)}">${escapeHtml(m.name)}</div>`
        )
    ].join('');

    return `
        <div class="assignee-dropdown" data-issue-id="${issueId}" data-current-assignee-id="${escapeHtml(assigneeId)}">
            <span class="assignee-badge assignee-clickable"
                  onclick="event.stopPropagation(); toggleAssigneeDropdown(event, '${issueId}')">
                @${escapeHtml(assigneeName)}
                <span class="assignee-dropdown-arrow">▼</span>
            </span>
            <div class="assignee-dropdown-menu" id="assigneeMenu-${issueId}">
                <div class="assignee-search-container">
                    <input type="text" class="assignee-search-input" placeholder="Search..."
                           onclick="event.stopPropagation()"
                           oninput="filterAssigneeOptions(this, '${issueId}')">
                </div>
                <div class="assignee-options-container">
                    ${optionsHtml}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render active filter badges
 */
export function renderActiveFilterBadges(
    filterOptions: FilterOptions | undefined,
    versions: RedmineVersion[],
    assignees: AssigneeInfo[],
    defaultStatuses?: string[]
): string {
    if (!filterOptions) return '';
    const badges: string[] = [];

    if (filterOptions.searchText) {
        badges.push(`<span class="active-filter-badge" data-filter="search">
            Search: "${escapeHtml(filterOptions.searchText)}"
            <span class="remove-filter" onclick="clearFilter('search')">×</span>
        </span>`);
    }
    if (filterOptions.versionId) {
        const version = versions.find(v => v.id === filterOptions.versionId);
        badges.push(`<span class="active-filter-badge" data-filter="version">
            Version: ${escapeHtml(version?.name || filterOptions.versionId)}
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
                Status: ${escapeHtml(statusText)}
                <span class="remove-filter" onclick="clearFilter('status')">×</span>
            </span>`);
        }
    }
    if (filterOptions.assigneeId) {
        const assignee = assignees.find(a => a.id === filterOptions.assigneeId);
        badges.push(`<span class="active-filter-badge" data-filter="assignee">
            Assignee: ${escapeHtml(assignee?.name || filterOptions.assigneeId)}
            <span class="remove-filter" onclick="clearFilter('assignee')">×</span>
        </span>`);
    }
    if (filterOptions.trackerType) {
        badges.push(`<span class="active-filter-badge" data-filter="tracker">
            Type: ${escapeHtml(filterOptions.trackerType)}
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

/**
 * Render "not configured" HTML page
 */
export function getNotConfiguredHtml(): string {
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

/**
 * Render error HTML page
 */
export function getErrorHtml(message: string): string {
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
        <p>${escapeHtml(message)}</p>
    </div>
</body>
</html>`;
}
