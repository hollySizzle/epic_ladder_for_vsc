import * as vscode from 'vscode';
import { McpClient, McpError } from './mcpClient';
import { RedmineIssuesProvider } from './treeView';
import { EpicLadderWebviewProvider } from './webview';

let mcpClient: McpClient | undefined;
let issuesProvider: RedmineIssuesProvider;
let webviewProvider: EpicLadderWebviewProvider;

/**
 * Expands environment variable references in a string.
 * Supports both ${env:VARIABLE_NAME} and ${VARIABLE_NAME} formats.
 * @param value - The string that may contain environment variable references
 * @returns The string with environment variables expanded
 */
export function expandEnvVariables(value: string | undefined): string | undefined {
    if (!value) {
        return value;
    }

    // Match ${env:VARIABLE_NAME} or ${VARIABLE_NAME} pattern
    // ${env:VAR} format (VS Code standard)
    // ${VAR} format (simple)
    const envPattern = /\$\{(?:env:)?([^}]+)\}/g;

    return value.replace(envPattern, (match, envVarName) => {
        const envValue = process.env[envVarName];
        if (envValue === undefined) {
            console.warn(`Environment variable "${envVarName}" is not set`);
            return match; // Return original if not found
        }
        return envValue;
    });
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Redmine Epic Ladder extension is now active');

    // Initialize TreeView Provider
    issuesProvider = new RedmineIssuesProvider();
    const treeView = vscode.window.createTreeView('redmineIssues', {
        treeDataProvider: issuesProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Initialize Webview Provider
    webviewProvider = new EpicLadderWebviewProvider(context.extensionUri);
    context.subscriptions.push({ dispose: () => webviewProvider.dispose() });

    // Initialize MCP Client
    initializeMcpClient();

    // Register configuration change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('redmine')) {
                initializeMcpClient();
            }
        })
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('redmine.refresh', handleRefresh),
        vscode.commands.registerCommand('redmine.openIssue', handleOpenIssue),
        vscode.commands.registerCommand('redmine.openIssueById', handleOpenIssueById),
        vscode.commands.registerCommand('redmine.configure', handleConfigure),
        vscode.commands.registerCommand('redmine.showEpicLadder', handleShowEpicLadder)
    );
}

function initializeMcpClient(): void {
    const config = vscode.workspace.getConfiguration('redmine');
    const serverUrl = expandEnvVariables(config.get<string>('url'));
    const apiKey = expandEnvVariables(config.get<string>('apiKey'));
    const defaultProject = expandEnvVariables(config.get<string>('defaultProject'));

    // Check required settings
    const missingSettings: string[] = [];
    if (!serverUrl) {
        missingSettings.push('URL');
    }
    if (!apiKey) {
        missingSettings.push('API Key');
    }

    if (missingSettings.length > 0) {
        mcpClient = undefined;
        console.log('MCP Client not initialized: Missing settings:', missingSettings.join(', '));
        vscode.window.showWarningMessage(
            `Redmine settings incomplete: ${missingSettings.join(', ')} not configured.`,
            'Open Settings'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'redmine');
            }
        });
    } else {
        mcpClient = new McpClient({
            serverUrl: serverUrl!,
            apiKey: apiKey!,
            defaultProject: defaultProject || undefined
        });
        console.log('MCP Client initialized with URL:', serverUrl);
    }

    // Update TreeView provider
    issuesProvider.setMcpClient(mcpClient);

    // Update Webview provider
    webviewProvider.setMcpClient(mcpClient);
}

export function getMcpClient(): McpClient | undefined {
    return mcpClient;
}

async function handleRefresh(): Promise<void> {
    if (!mcpClient) {
        vscode.window.showWarningMessage('Redmine URL is not configured. Please configure it first.');
        return;
    }

    try {
        issuesProvider.refresh();
        vscode.window.showInformationMessage('Redmine issues refreshed');
    } catch (error) {
        handleMcpError(error, 'refresh');
    }
}

async function handleOpenIssue(): Promise<void> {
    if (!mcpClient) {
        vscode.window.showWarningMessage('Redmine URL is not configured.');
        return;
    }

    const issueId = await vscode.window.showInputBox({
        prompt: 'Enter Issue ID',
        placeHolder: 'e.g., 1234'
    });

    if (!issueId) {
        return;
    }

    try {
        const result = await mcpClient.getIssueDetail(issueId);
        if (result.success) {
            const issue = result.issue;
            const content = `# ${issue.subject}

**ID:** ${issue.id}
**Status:** ${issue.status.name}
**Tracker:** ${issue.tracker.name}
**Priority:** ${issue.priority.name}
**Assigned to:** ${issue.assigned_to?.name ?? 'Unassigned'}
**Version:** ${issue.fixed_version?.name ?? 'None'}

## Description
${issue.description || 'No description'}

---
[Open in Redmine](${issue.url})
`;
            const doc = await vscode.workspace.openTextDocument({
                content,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
        }
    } catch (error) {
        handleMcpError(error, 'open issue');
    }
}

async function handleConfigure(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'redmine');
}

async function handleShowEpicLadder(): Promise<void> {
    await webviewProvider.show();
}

async function handleOpenIssueById(issueId: string): Promise<void> {
    if (!mcpClient) {
        vscode.window.showWarningMessage('Redmine URL is not configured.');
        return;
    }

    try {
        const result = await mcpClient.getIssueDetail(issueId);
        if (result.success) {
            const issue = result.issue;
            const content = `# ${issue.subject}

**ID:** ${issue.id}
**Status:** ${issue.status.name}
**Tracker:** ${issue.tracker.name}
**Priority:** ${issue.priority.name}
**Assigned to:** ${issue.assigned_to?.name ?? 'Unassigned'}
**Version:** ${issue.fixed_version?.name ?? 'None'}

## Description
${issue.description || 'No description'}

---
[Open in Redmine](${issue.url})
`;
            const doc = await vscode.workspace.openTextDocument({
                content,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
        }
    } catch (error) {
        handleMcpError(error, 'open issue');
    }
}

function handleMcpError(error: unknown, operation: string): void {
    if (error instanceof McpError) {
        vscode.window.showErrorMessage(`MCP Error (${operation}): ${error.message} [Code: ${error.code}]`);
    } else if (error instanceof Error) {
        vscode.window.showErrorMessage(`Error (${operation}): ${error.message}`);
    } else {
        vscode.window.showErrorMessage(`Unknown error during ${operation}`);
    }
}

export function deactivate() {
    mcpClient = undefined;
}
