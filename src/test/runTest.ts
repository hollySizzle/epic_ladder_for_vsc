import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // VS Code実行ファイルを含むフォルダ
        // 開発環境では自動的にダウンロードされる
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // テストランナースクリプトへのパス
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // VS Codeをダウンロードし、テストを実行
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                '--disable-extensions', // 他の拡張機能を無効化
            ]
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();
