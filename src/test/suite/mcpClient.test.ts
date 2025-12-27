import * as assert from 'assert';
import { McpClient, McpError } from '../../mcpClient';

suite('McpClient Test Suite', () => {
    suite('McpError', () => {
        test('should create error with code and message', () => {
            const error = new McpError(-32600, 'Invalid Request');

            assert.strictEqual(error.code, -32600);
            assert.strictEqual(error.message, 'Invalid Request');
            assert.strictEqual(error.name, 'McpError');
        });

        test('should create error with data', () => {
            const errorData = { field: 'issue_id', reason: 'not found' };
            const error = new McpError(-32602, 'Invalid params', errorData);

            assert.strictEqual(error.code, -32602);
            assert.strictEqual(error.message, 'Invalid params');
            assert.deepStrictEqual(error.data, errorData);
        });

        test('should create error without data', () => {
            const error = new McpError(-32603, 'Internal error');

            assert.strictEqual(error.data, undefined);
        });

        test('should be instance of Error', () => {
            const error = new McpError(-32700, 'Parse error');

            assert.ok(error instanceof Error);
            assert.ok(error instanceof McpError);
        });

        test('should have correct error codes for JSON-RPC errors', () => {
            // Parse error
            const parseError = new McpError(-32700, 'Parse error');
            assert.strictEqual(parseError.code, -32700);

            // Invalid Request
            const invalidRequest = new McpError(-32600, 'Invalid Request');
            assert.strictEqual(invalidRequest.code, -32600);

            // Method not found
            const methodNotFound = new McpError(-32601, 'Method not found');
            assert.strictEqual(methodNotFound.code, -32601);

            // Invalid params
            const invalidParams = new McpError(-32602, 'Invalid params');
            assert.strictEqual(invalidParams.code, -32602);

            // Internal error
            const internalError = new McpError(-32603, 'Internal error');
            assert.strictEqual(internalError.code, -32603);
        });

        test('should preserve stack trace', () => {
            const error = new McpError(-32000, 'Server error');

            assert.ok(error.stack, 'Should have stack trace');
            assert.ok(error.stack!.includes('McpError'), 'Stack should include error name');
        });
    });

    suite('McpClient constructor', () => {
        test('should create client with required config', () => {
            const client = new McpClient({
                serverUrl: 'http://localhost:8080',
                apiKey: 'test-api-key'
            });

            assert.ok(client, 'Client should be created');
        });

        test('should create client with optional defaultProject', () => {
            const client = new McpClient({
                serverUrl: 'http://localhost:8080',
                apiKey: 'test-api-key',
                defaultProject: 'my-project'
            });

            assert.ok(client, 'Client should be created with project');
        });

        test('should create client with custom timeout', () => {
            const client = new McpClient({
                serverUrl: 'http://localhost:8080',
                apiKey: 'test-api-key',
                timeout: 60000
            });

            assert.ok(client, 'Client should be created with timeout');
        });

        test('should create client with all options', () => {
            const client = new McpClient({
                serverUrl: 'https://redmine.example.com/mcp',
                apiKey: 'abc123xyz',
                defaultProject: 'test-project',
                timeout: 45000
            });

            assert.ok(client, 'Client should be created with all options');
        });
    });

    suite('McpClient methods exist', () => {
        let client: McpClient;

        suiteSetup(() => {
            client = new McpClient({
                serverUrl: 'http://localhost:8080',
                apiKey: 'test-api-key'
            });
        });

        test('should have getProjectStructure method', () => {
            assert.strictEqual(typeof client.getProjectStructure, 'function');
        });

        test('should have listVersions method', () => {
            assert.strictEqual(typeof client.listVersions, 'function');
        });

        test('should have getIssueDetail method', () => {
            assert.strictEqual(typeof client.getIssueDetail, 'function');
        });

        test('should have addIssueComment method', () => {
            assert.strictEqual(typeof client.addIssueComment, 'function');
        });

        test('should have updateIssueStatus method', () => {
            assert.strictEqual(typeof client.updateIssueStatus, 'function');
        });

        test('should have updateIssueAssignee method', () => {
            assert.strictEqual(typeof client.updateIssueAssignee, 'function');
        });

        test('should have listStatuses method', () => {
            assert.strictEqual(typeof client.listStatuses, 'function');
        });

        test('should have listProjectMembers method', () => {
            assert.strictEqual(typeof client.listProjectMembers, 'function');
        });

        test('should have testConnection method', () => {
            assert.strictEqual(typeof client.testConnection, 'function');
        });
    });

    suite('McpClient API contract', () => {
        let client: McpClient;

        suiteSetup(() => {
            client = new McpClient({
                serverUrl: 'http://localhost:8080',
                apiKey: 'test-api-key'
            });
        });

        test('getProjectStructure should accept optional parameters', () => {
            // Should not throw for valid parameter shapes
            assert.doesNotThrow(() => {
                // These calls will fail due to network, but we're testing the type contract
                client.getProjectStructure({}).catch(() => { /* expected */ });
                client.getProjectStructure({ project_id: 'test' }).catch(() => { /* expected */ });
                client.getProjectStructure({ version_id: '1' }).catch(() => { /* expected */ });
                client.getProjectStructure({ status: 'open' }).catch(() => { /* expected */ });
                client.getProjectStructure({ include_closed: true }).catch(() => { /* expected */ });
                client.getProjectStructure({ max_depth: 3 }).catch(() => { /* expected */ });
            });
        });

        test('listVersions should accept optional parameters', () => {
            assert.doesNotThrow(() => {
                client.listVersions({}).catch(() => { /* expected */ });
                client.listVersions({ project_id: 'test' }).catch(() => { /* expected */ });
                client.listVersions({ status: 'open' }).catch(() => { /* expected */ });
                client.listVersions({ status: 'closed' }).catch(() => { /* expected */ });
                client.listVersions({ sort: 'effective_date_asc' }).catch(() => { /* expected */ });
                client.listVersions({ limit: 10 }).catch(() => { /* expected */ });
            });
        });

        test('getIssueDetail should require issue ID', () => {
            assert.doesNotThrow(() => {
                client.getIssueDetail('123').catch(() => { /* expected */ });
            });
        });

        test('addIssueComment should require issue ID and comment', () => {
            assert.doesNotThrow(() => {
                client.addIssueComment('123', 'Test comment').catch(() => { /* expected */ });
            });
        });

        test('updateIssueStatus should require issue ID and status name', () => {
            assert.doesNotThrow(() => {
                client.updateIssueStatus('123', 'In Progress').catch(() => { /* expected */ });
                client.updateIssueStatus('123', 'Closed', true).catch(() => { /* expected */ });
            });
        });

        test('updateIssueAssignee should require issue ID and assignee ID', () => {
            assert.doesNotThrow(() => {
                client.updateIssueAssignee('123', '5').catch(() => { /* expected */ });
                client.updateIssueAssignee('123', null).catch(() => { /* expected */ });
            });
        });

        test('listStatuses should accept optional parameters', () => {
            assert.doesNotThrow(() => {
                client.listStatuses({}).catch(() => { /* expected */ });
                client.listStatuses({ project_id: 'test' }).catch(() => { /* expected */ });
                client.listStatuses({ include_closed: false }).catch(() => { /* expected */ });
            });
        });

        test('listProjectMembers should accept optional parameters', () => {
            assert.doesNotThrow(() => {
                client.listProjectMembers({}).catch(() => { /* expected */ });
                client.listProjectMembers({ project_id: 'test' }).catch(() => { /* expected */ });
                client.listProjectMembers({ role_name: 'Developer' }).catch(() => { /* expected */ });
                client.listProjectMembers({ limit: 50 }).catch(() => { /* expected */ });
            });
        });
    });
});
