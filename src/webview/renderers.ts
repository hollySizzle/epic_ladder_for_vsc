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
export function renderEpics(epics: ProjectStructureEpic[], redmineUrl: string): string {
    if (!epics || epics.length === 0) {
        return '<div class="empty-state">No epics found</div>';
    }

    return epics.map(epic => `
        <div class="tree-item tree-item-epic" data-id="${epic.id}">
            <div class="tree-item-header" onclick="toggleDetail(event, '${epic.id}')">
                <span class="collapse-icon" onclick="event.stopPropagation(); toggleCollapse(this.parentElement)">&#9662;</span>
                <span class="type-badge badge-epic">Epic</span>
                ${renderStatusBadge(epic.id, epic.status)}
                <a class="issue-id" href="${redmineUrl}/issues/${epic.id}" onclick="event.stopPropagation(); event.preventDefault(); openInBrowser('${redmineUrl}/issues/${epic.id}')">#${epic.id}</a>
                <span class="issue-subject">${escapeHtml(epic.subject)}</span>
            </div>
            <div class="tree-children">
                ${renderFeatures(epic.features, redmineUrl)}
            </div>
        </div>
    `).join('');
}

/**
 * Render features as HTML tree
 */
export function renderFeatures(features: ProjectStructureEpic['features'], redmineUrl: string): string {
    if (!features || features.length === 0) {
        return '';
    }

    return features.map(feature => `
        <div class="tree-item tree-item-feature" data-id="${feature.id}">
            <div class="tree-item-header" onclick="toggleDetail(event, '${feature.id}')">
                <span class="collapse-icon" onclick="event.stopPropagation(); toggleCollapse(this.parentElement)">&#9662;</span>
                <span class="type-badge badge-feature">Feature</span>
                ${renderStatusBadge(feature.id, feature.status)}
                <a class="issue-id" href="${redmineUrl}/issues/${feature.id}" onclick="event.stopPropagation(); event.preventDefault(); openInBrowser('${redmineUrl}/issues/${feature.id}')">#${feature.id}</a>
                <span class="issue-subject">${escapeHtml(feature.subject)}</span>
            </div>
            <div class="tree-children">
                ${renderUserStories(feature.user_stories, redmineUrl)}
            </div>
        </div>
    `).join('');
}

/**
 * Render user stories as HTML tree
 */
export function renderUserStories(stories: ProjectStructureEpic['features'][0]['user_stories'], redmineUrl: string): string {
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
                ${story.assigned_to ? `<span class="assignee">@${escapeHtml(story.assigned_to.name)}</span>` : ''}
                ${story.version ? `<span class="version">${escapeHtml(story.version.name)}</span>` : ''}
            </div>
        ` : '';

        return `
            <div class="tree-item tree-item-story" data-id="${story.id}">
                <div class="tree-item-header ${hasChildren ? '' : 'no-children'}" onclick="toggleDetail(event, '${story.id}')">
                    ${hasChildren ? `<span class="collapse-icon" onclick="event.stopPropagation(); toggleCollapse(this.parentElement)">&#9662;</span>` : '<span class="collapse-icon-placeholder"></span>'}
                    <span class="type-badge badge-story">Story</span>
                    ${renderStatusBadge(story.id, story.status)}
                    <a class="issue-id" href="${redmineUrl}/issues/${story.id}" onclick="event.stopPropagation(); event.preventDefault(); openInBrowser('${redmineUrl}/issues/${story.id}')">#${story.id}</a>
                    <span class="issue-subject">${escapeHtml(story.subject)}</span>
                    ${metaInfo}
                </div>
                ${hasChildren ? `
                    <div class="tree-children">
                        ${renderChildren(story.children!, redmineUrl)}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Render children (tasks, bugs, tests) as HTML
 */
export function renderChildren(children: NonNullable<ProjectStructureEpic['features'][0]['user_stories'][0]['children']>, redmineUrl: string): string {
    const items: string[] = [];

    children.tasks.forEach(task => {
        items.push(renderLeafItem(task, 'Task', 'badge-task', redmineUrl));
    });

    children.bugs.forEach(bug => {
        items.push(renderLeafItem(bug, 'Bug', 'badge-bug', redmineUrl));
    });

    children.tests.forEach(test => {
        items.push(renderLeafItem(test, 'Test', 'badge-test', redmineUrl));
    });

    return items.join('');
}

/**
 * Render a leaf item (task, bug, or test)
 */
export function renderLeafItem(
    item: { id: string; subject: string; status: { name: string; is_closed: boolean }; assigned_to?: { name: string } },
    type: string,
    badgeClass: string,
    redmineUrl: string
): string {
    const metaInfo = item.assigned_to ? `
        <div class="meta-info">
            <span class="assignee">@${escapeHtml(item.assigned_to.name)}</span>
        </div>
    ` : '';

    return `
        <div class="tree-item tree-item-leaf" data-id="${item.id}">
            <div class="tree-item-header no-children" onclick="toggleDetail(event, '${item.id}')">
                <span class="collapse-icon-placeholder"></span>
                <span class="type-badge ${badgeClass}">${type}</span>
                ${renderStatusBadge(item.id, item.status)}
                <a class="issue-id" href="${redmineUrl}/issues/${item.id}" onclick="event.stopPropagation(); event.preventDefault(); openInBrowser('${redmineUrl}/issues/${item.id}')">#${item.id}</a>
                <span class="issue-subject">${escapeHtml(item.subject)}</span>
                ${metaInfo}
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
export function renderStatusBadge(issueId: string, status: { name: string; is_closed: boolean }): string {
    const statusOptions = ['未着手', '着手中', 'クローズ'];
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
