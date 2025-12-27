import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import {
    ProjectStructureEpic,
    ProjectStructureFeature,
    ProjectStructureUserStory,
    ProjectStructureTaskItem,
    ProjectStructureStatus
} from './types';

// 多言語対応メッセージ
const isJa = vscode.env.language.startsWith('ja');
const messages = {
    configureRedmineUrl: isJa ? 'Redmine URLを設定してください' : 'Please configure Redmine URL',
    fetchFailed: isJa ? 'データの取得に失敗しました' : 'Failed to fetch data',
    noEpicsFound: isJa ? 'Epicが見つかりません' : 'No Epics found',
    unknownError: isJa ? '不明なエラー' : 'Unknown error',
    errorPrefix: isJa ? 'エラー' : 'Error',
};

// TreeView用の統一インターフェース
interface TreeItemData {
    id: string;
    subject: string;
    type: string;
    status: ProjectStructureStatus;
    assignedTo?: string;
    version?: string;
    children?: TreeItemData[];
}

export class RedmineIssuesProvider implements vscode.TreeDataProvider<RedmineTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RedmineTreeItem | undefined | null | void> =
        new vscode.EventEmitter<RedmineTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RedmineTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private mcpClient: McpClient | undefined;
    private cachedData: TreeItemData[] | undefined;

    constructor() {}

    setMcpClient(client: McpClient | undefined): void {
        this.mcpClient = client;
        this.cachedData = undefined;
        this.refresh();
    }

    refresh(): void {
        this.cachedData = undefined;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: RedmineTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: RedmineTreeItem): Promise<RedmineTreeItem[]> {
        if (!this.mcpClient) {
            return [new MessageTreeItem(messages.configureRedmineUrl, 'warning')];
        }

        try {
            if (!element) {
                // Root level: fetch and convert Epic structure
                if (!this.cachedData) {
                    const response = await this.mcpClient.getProjectStructure({
                        max_depth: 4,
                        include_closed: false
                    });
                    if (response.success) {
                        this.cachedData = this.convertEpicsToTreeData(response.structure);
                    } else {
                        return [new MessageTreeItem(messages.fetchFailed, 'error')];
                    }
                }

                if (!this.cachedData || this.cachedData.length === 0) {
                    return [new MessageTreeItem(messages.noEpicsFound, 'info')];
                }

                return this.cachedData.map(item => new RedmineIssueTreeItem(item));
            } else if (element instanceof RedmineIssueTreeItem && element.data.children) {
                return element.data.children.map(child => new RedmineIssueTreeItem(child));
            }

            return [];
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : messages.unknownError;
            return [new MessageTreeItem(`${messages.errorPrefix}: ${errMsg}`, 'error')];
        }
    }

    private convertEpicsToTreeData(epics: ProjectStructureEpic[]): TreeItemData[] {
        return epics.map(epic => ({
            id: epic.id,
            subject: epic.subject,
            type: epic.type,
            status: epic.status,
            children: this.convertFeaturesToTreeData(epic.features)
        }));
    }

    private convertFeaturesToTreeData(features: ProjectStructureFeature[]): TreeItemData[] {
        return features.map(feature => ({
            id: feature.id,
            subject: feature.subject,
            type: feature.type,
            status: feature.status,
            children: this.convertUserStoriesToTreeData(feature.user_stories)
        }));
    }

    private convertUserStoriesToTreeData(userStories: ProjectStructureUserStory[]): TreeItemData[] {
        return userStories.map(story => ({
            id: story.id,
            subject: story.subject,
            type: story.type,
            status: story.status,
            assignedTo: story.assigned_to?.name,
            version: story.version?.name,
            children: this.convertChildrenToTreeData(story.children)
        }));
    }

    private convertChildrenToTreeData(children?: { tasks: ProjectStructureTaskItem[]; bugs: ProjectStructureTaskItem[]; tests: ProjectStructureTaskItem[] }): TreeItemData[] | undefined {
        if (!children) {
            return undefined;
        }

        const result: TreeItemData[] = [];

        for (const task of children.tasks) {
            result.push({
                id: task.id,
                subject: task.subject,
                type: 'Task',
                status: task.status,
                assignedTo: task.assigned_to?.name
            });
        }

        for (const bug of children.bugs) {
            result.push({
                id: bug.id,
                subject: bug.subject,
                type: 'Bug',
                status: bug.status,
                assignedTo: bug.assigned_to?.name
            });
        }

        for (const test of children.tests) {
            result.push({
                id: test.id,
                subject: test.subject,
                type: 'Test',
                status: test.status,
                assignedTo: test.assigned_to?.name
            });
        }

        return result.length > 0 ? result : undefined;
    }
}

export type RedmineTreeItem = RedmineIssueTreeItem | MessageTreeItem;

export class RedmineIssueTreeItem extends vscode.TreeItem {
    constructor(public readonly data: TreeItemData) {
        const hasChildren = data.children && data.children.length > 0;
        super(
            data.subject,
            hasChildren
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        this.id = data.id;
        this.tooltip = this.createTooltip();
        this.description = this.createDescription();
        this.iconPath = this.getIcon();
        this.contextValue = `redmineIssue-${data.type.toLowerCase()}`;

        this.command = {
            command: 'redmine.openIssueById',
            title: 'Open Issue',
            arguments: [data.id]
        };
    }

    private createTooltip(): string {
        const parts = [
            `#${this.data.id} ${this.data.subject}`,
            `Type: ${this.data.type}`,
            `Status: ${this.data.status.name}`
        ];
        if (this.data.assignedTo) {
            parts.push(`Assigned: ${this.data.assignedTo}`);
        }
        if (this.data.version) {
            parts.push(`Version: ${this.data.version}`);
        }
        return parts.join('\n');
    }

    private createDescription(): string {
        const parts: string[] = [];
        parts.push(`#${this.data.id}`);
        if (this.data.status.name) {
            parts.push(this.data.status.name);
        }
        return parts.join(' | ');
    }

    private getIcon(): vscode.ThemeIcon {
        // Status-based icons
        const status = this.data.status.name.toLowerCase();

        if (this.data.status.is_closed || status.includes('closed') || status.includes('クローズ')) {
            return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        }
        if (status.includes('progress') || status.includes('着手') || status.includes('進行')) {
            return new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('charts.blue'));
        }
        if (status.includes('review') || status.includes('レビュー')) {
            return new vscode.ThemeIcon('eye', new vscode.ThemeColor('charts.purple'));
        }
        if (status.includes('block') || status.includes('保留')) {
            return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
        }

        // Type-based icons for open/new status
        const type = this.data.type.toLowerCase();

        if (type.includes('epic') || type === 'エピック') {
            return new vscode.ThemeIcon('layers', new vscode.ThemeColor('charts.yellow'));
        }
        if (type.includes('feature') || type === '機能') {
            return new vscode.ThemeIcon('package', new vscode.ThemeColor('charts.orange'));
        }
        if (type.includes('story') || type.includes('ストーリ') || type === 'userstory') {
            return new vscode.ThemeIcon('bookmark', new vscode.ThemeColor('charts.blue'));
        }
        if (type.includes('task') || type === 'タスク') {
            return new vscode.ThemeIcon('tasklist', new vscode.ThemeColor('charts.green'));
        }
        if (type.includes('bug') || type === 'バグ') {
            return new vscode.ThemeIcon('bug', new vscode.ThemeColor('charts.red'));
        }
        if (type.includes('test') || type === 'テスト') {
            return new vscode.ThemeIcon('beaker', new vscode.ThemeColor('charts.purple'));
        }

        return new vscode.ThemeIcon('circle-outline');
    }
}

class MessageTreeItem extends vscode.TreeItem {
    constructor(message: string, type: 'info' | 'warning' | 'error') {
        super(message, vscode.TreeItemCollapsibleState.None);

        switch (type) {
            case 'error':
                this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
                break;
            case 'warning':
                this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('editorInfo.foreground'));
        }
    }
}
