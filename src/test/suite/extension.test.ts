import * as assert from 'assert';
import * as vscode from 'vscode';
import { isCommandRegistered, sleep, activateExtension } from './helpers';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting extension tests.');

    test('Extension should be present', () => {
        const ext = vscode.extensions.getExtension('hollySizzle.redmine-epic-ladder');
        assert.ok(ext, 'Extension should be found');
    });

    test('Redmine commands should be registered after activation', async function() {
        this.timeout(10000);

        // 拡張機能をアクティベート
        const ext = await activateExtension();
        assert.ok(ext, 'Extension should be activated');

        // アクティベーション後の待機
        await sleep(2000);

        const commands = [
            'redmine.refresh',
            'redmine.openIssue',
            'redmine.openIssueById',
            'redmine.configure'
        ];

        for (const cmd of commands) {
            const registered = await isCommandRegistered(cmd);
            assert.ok(registered, `Command ${cmd} should be registered`);
        }
    });

    test('TreeView API should be available', async () => {
        await sleep(500);

        // TreeViewが登録されているかを確認
        const views = vscode.window.registerTreeDataProvider;
        assert.ok(views, 'TreeDataProvider registration should be available');
    });

    test('Configuration should have correct properties', () => {
        const config = vscode.workspace.getConfiguration('redmine');

        // 設定項目が存在することを確認
        const url = config.inspect('url');
        const apiKey = config.inspect('apiKey');
        const defaultProject = config.inspect('defaultProject');

        assert.ok(url, 'redmine.url configuration should exist');
        assert.ok(apiKey, 'redmine.apiKey configuration should exist');
        assert.ok(defaultProject, 'redmine.defaultProject configuration should exist');
    });
});
