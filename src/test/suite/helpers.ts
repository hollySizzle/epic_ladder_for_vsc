import * as vscode from 'vscode';

/**
 * VS Code拡張機能テスト用ヘルパー関数
 */

/**
 * 拡張機能のアクティベーションを待機
 */
export async function activateExtension(): Promise<vscode.Extension<unknown> | undefined> {
    const ext = vscode.extensions.getExtension('hollySizzle.redmine-epic-ladder');
    if (ext) {
        await ext.activate();
    }
    return ext;
}

/**
 * 指定した時間待機
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * コマンドが登録されているか確認
 */
export async function isCommandRegistered(command: string): Promise<boolean> {
    const commands = await vscode.commands.getCommands();
    return commands.includes(command);
}

/**
 * 設定値を一時的に変更してテストを実行
 */
export async function withConfig<T>(
    section: string,
    key: string,
    value: unknown,
    callback: () => Promise<T>
): Promise<T> {
    const config = vscode.workspace.getConfiguration(section);
    const original = config.get(key);

    await config.update(key, value, vscode.ConfigurationTarget.Global);
    try {
        return await callback();
    } finally {
        await config.update(key, original, vscode.ConfigurationTarget.Global);
    }
}

/**
 * モックのRedmine APIレスポンスを生成
 */
export function createMockIssue(overrides: Partial<{
    id: number;
    subject: string;
    description: string;
    tracker: { id: number; name: string };
    status: { id: number; name: string };
    priority: { id: number; name: string };
}>): object {
    return {
        id: 1,
        subject: 'Test Issue',
        description: 'Test description',
        tracker: { id: 1, name: 'Task' },
        status: { id: 1, name: 'Open' },
        priority: { id: 2, name: 'Normal' },
        ...overrides
    };
}

/**
 * モックのプロジェクトを生成
 */
export function createMockProject(overrides: Partial<{
    id: number;
    name: string;
    identifier: string;
}>): object {
    return {
        id: 1,
        name: 'Test Project',
        identifier: 'test-project',
        ...overrides
    };
}
