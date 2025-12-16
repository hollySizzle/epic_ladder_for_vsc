import * as assert from 'assert';
import { createMockIssue, createMockProject, sleep } from './helpers';

suite('Test Helpers Suite', () => {
    test('sleep should wait for specified time', async () => {
        const start = Date.now();
        await sleep(100);
        const elapsed = Date.now() - start;

        assert.ok(elapsed >= 90, 'Should wait at least 90ms');
        assert.ok(elapsed < 200, 'Should not wait too long');
    });

    test('createMockIssue should create default issue', () => {
        const issue = createMockIssue({}) as {
            id: number;
            subject: string;
            description: string;
            tracker: { id: number; name: string };
            status: { id: number; name: string };
            priority: { id: number; name: string };
        };

        assert.strictEqual(issue.id, 1);
        assert.strictEqual(issue.subject, 'Test Issue');
        assert.strictEqual(issue.description, 'Test description');
        assert.strictEqual(issue.tracker.name, 'Task');
        assert.strictEqual(issue.status.name, 'Open');
        assert.strictEqual(issue.priority.name, 'Normal');
    });

    test('createMockIssue should allow overrides', () => {
        const issue = createMockIssue({
            id: 42,
            subject: 'Custom Issue',
            status: { id: 2, name: 'In Progress' }
        }) as {
            id: number;
            subject: string;
            status: { id: number; name: string };
        };

        assert.strictEqual(issue.id, 42);
        assert.strictEqual(issue.subject, 'Custom Issue');
        assert.strictEqual(issue.status.name, 'In Progress');
    });

    test('createMockProject should create default project', () => {
        const project = createMockProject({}) as {
            id: number;
            name: string;
            identifier: string;
        };

        assert.strictEqual(project.id, 1);
        assert.strictEqual(project.name, 'Test Project');
        assert.strictEqual(project.identifier, 'test-project');
    });

    test('createMockProject should allow overrides', () => {
        const project = createMockProject({
            id: 100,
            name: 'My Project',
            identifier: 'my-project'
        }) as {
            id: number;
            name: string;
            identifier: string;
        };

        assert.strictEqual(project.id, 100);
        assert.strictEqual(project.name, 'My Project');
        assert.strictEqual(project.identifier, 'my-project');
    });
});
