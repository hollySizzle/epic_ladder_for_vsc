import * as assert from 'assert';
import * as vscode from 'vscode';
import { isCommandRegistered, sleep, activateExtension } from './helpers';
import { expandEnvVariables } from '../../extension';

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

suite('expandEnvVariables Test Suite', () => {
    const originalEnv = { ...process.env };

    setup(() => {
        // Set up test environment variables
        process.env['TEST_VAR'] = 'test_value';
        process.env['ANOTHER_VAR'] = 'another_value';
    });

    teardown(() => {
        // Restore original environment
        process.env = { ...originalEnv };
    });

    test('should return undefined for undefined input', () => {
        assert.strictEqual(expandEnvVariables(undefined), undefined);
    });

    test('should return empty string for empty input', () => {
        assert.strictEqual(expandEnvVariables(''), '');
    });

    test('should return string as-is when no env variables present', () => {
        assert.strictEqual(expandEnvVariables('https://example.com'), 'https://example.com');
    });

    test('should expand single environment variable', () => {
        const result = expandEnvVariables('${env:TEST_VAR}');
        assert.strictEqual(result, 'test_value');
    });

    test('should expand environment variable within text', () => {
        const result = expandEnvVariables('https://${env:TEST_VAR}.example.com');
        assert.strictEqual(result, 'https://test_value.example.com');
    });

    test('should expand multiple environment variables', () => {
        const result = expandEnvVariables('${env:TEST_VAR}-${env:ANOTHER_VAR}');
        assert.strictEqual(result, 'test_value-another_value');
    });

    test('should keep original pattern for undefined environment variable', () => {
        const result = expandEnvVariables('${env:UNDEFINED_VAR}');
        assert.strictEqual(result, '${env:UNDEFINED_VAR}');
    });

    test('should handle mixed defined and undefined variables', () => {
        const result = expandEnvVariables('${env:TEST_VAR}-${env:UNDEFINED_VAR}');
        assert.strictEqual(result, 'test_value-${env:UNDEFINED_VAR}');
    });

    // Tests for ${VARIABLE_NAME} format (without env: prefix)
    test('should expand simple format ${VAR}', () => {
        const result = expandEnvVariables('${TEST_VAR}');
        assert.strictEqual(result, 'test_value');
    });

    test('should expand simple format within text', () => {
        const result = expandEnvVariables('https://${TEST_VAR}.example.com');
        assert.strictEqual(result, 'https://test_value.example.com');
    });

    test('should expand multiple simple format variables', () => {
        const result = expandEnvVariables('${TEST_VAR}-${ANOTHER_VAR}');
        assert.strictEqual(result, 'test_value-another_value');
    });

    test('should handle mixed formats (env: and simple)', () => {
        const result = expandEnvVariables('${env:TEST_VAR}-${ANOTHER_VAR}');
        assert.strictEqual(result, 'test_value-another_value');
    });

    test('should keep original simple pattern for undefined variable', () => {
        const result = expandEnvVariables('${UNDEFINED_VAR}');
        assert.strictEqual(result, '${UNDEFINED_VAR}');
    });
});
