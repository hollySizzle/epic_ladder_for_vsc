import * as vscode from 'vscode';
import { McpClient, McpError } from './mcpClient';

let mcpClient: McpClient | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Redmine Epic Ladder extension is now active');

    // Initialize MCP Client
    initializeMcpClient();

    // Register configuration change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('redmine.url')) {
                initializeMcpClient();
            }
        })
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('redmine.refresh', handleRefresh),
        vscode.commands.registerCommand('redmine.openIssue', handleOpenIssue),
        vscode.commands.registerCommand('redmine.configure', handleConfigure)
    );
}

function initializeMcpClient(): void {
    const config = vscode.workspace.getConfiguration('redmine');
    const serverUrl = config.get<string>('url');

    if (serverUrl) {
        mcpClient = new McpClient({ serverUrl });
        console.log('MCP Client initialized with URL:', serverUrl);
    } else {
        mcpClient = undefined;
        console.log('MCP Client not initialized: URL not configured');
    }
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
        const connected = await mcpClient.testConnection();
        if (connected) {
            vscode.window.showInformationMessage('Redmine connection successful');
        } else {
            vscode.window.showErrorMessage('Failed to connect to Redmine MCP server');
        }
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
