import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import { ProjectStructureItem } from './types';

export class RedmineIssuesProvider implements vscode.TreeDataProvider<RedmineTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RedmineTreeItem | undefined | null | void> =
        new vscode.EventEmitter<RedmineTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RedmineTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private mcpClient: McpClient | undefined;
    private cachedStructure: ProjectStructureItem[] | undefined;

    constructor() {}

    setMcpClient(client: McpClient | undefined): void {
        this.mcpClient = client;
        this.cachedStructure = undefined;
        this.refresh();
    }

    refresh(): void {
        this.cachedStructure = undefined;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: RedmineTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: RedmineTreeItem): Promise<RedmineTreeItem[]> {
        if (!this.mcpClient) {
            return [new MessageTreeItem('Redmine URLを設定してください', 'warning')];
        }

        try {
            if (!element) {
                // Root level: fetch Epic structure
                if (!this.cachedStructure) {
                    const response = await this.mcpClient.getProjectStructure({
                        max_depth: 4,
                        include_closed: false
                    });
                    if (response.success) {
                        this.cachedStructure = response.structure;
                    } else {
                        return [new MessageTreeItem('データの取得に失敗しました', 'error')];
                    }
                }

                if (!this.cachedStructure || this.cachedStructure.length === 0) {
                    return [new MessageTreeItem('Epicが見つかりません', 'info')];
                }

                return this.cachedStructure.map(item => new RedmineIssueTreeItem(item));
            } else if (element instanceof RedmineIssueTreeItem && element.item.children) {
                return element.item.children.map(child => new RedmineIssueTreeItem(child));
            }

            return [];
        } catch (error) {
            const message = error instanceof Error ? error.message : '不明なエラー';
            return [new MessageTreeItem(`エラー: ${message}`, 'error')];
        }
    }
}

export type RedmineTreeItem = RedmineIssueTreeItem | MessageTreeItem;

export class RedmineIssueTreeItem extends vscode.TreeItem {
    constructor(public readonly item: ProjectStructureItem) {
        const hasChildren = item.children && item.children.length > 0;
        super(
            item.subject,
            hasChildren
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        this.id = item.id;
        this.tooltip = this.createTooltip();
        this.description = this.createDescription();
        this.iconPath = this.getIcon();
        this.contextValue = `redmineIssue-${item.tracker.toLowerCase()}`;

        this.command = {
            command: 'redmine.openIssueById',
            title: 'Open Issue',
            arguments: [item.id]
        };
    }

    private createTooltip(): string {
        const parts = [
            `#${this.item.id} ${this.item.subject}`,
            `Tracker: ${this.item.tracker}`,
            `Status: ${this.item.status}`
        ];
        if (this.item.assigned_to) {
            parts.push(`Assigned: ${this.item.assigned_to}`);
        }
        if (this.item.version) {
            parts.push(`Version: ${this.item.version}`);
        }
        return parts.join('\n');
    }

    private createDescription(): string {
        const parts: string[] = [];
        parts.push(`#${this.item.id}`);
        if (this.item.status) {
            parts.push(this.item.status);
        }
        return parts.join(' | ');
    }

    private getIcon(): vscode.ThemeIcon {
        // Status-based icons
        const status = this.item.status.toLowerCase();

        if (status.includes('closed') || status.includes('クローズ')) {
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

        // Tracker-based icons for open/new status
        const tracker = this.item.tracker.toLowerCase();

        if (tracker.includes('epic')) {
            return new vscode.ThemeIcon('layers', new vscode.ThemeColor('charts.yellow'));
        }
        if (tracker.includes('feature')) {
            return new vscode.ThemeIcon('package', new vscode.ThemeColor('charts.orange'));
        }
        if (tracker.includes('story') || tracker.includes('ストーリ')) {
            return new vscode.ThemeIcon('bookmark', new vscode.ThemeColor('charts.blue'));
        }
        if (tracker.includes('task') || tracker.includes('タスク')) {
            return new vscode.ThemeIcon('tasklist', new vscode.ThemeColor('charts.green'));
        }
        if (tracker.includes('bug') || tracker.includes('バグ')) {
            return new vscode.ThemeIcon('bug', new vscode.ThemeColor('charts.red'));
        }
        if (tracker.includes('test') || tracker.includes('テスト')) {
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
