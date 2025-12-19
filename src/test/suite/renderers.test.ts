import * as assert from 'assert';
import {
    renderAssigneeBadge,
    renderStatusBadge,
    getStatusClass
} from '../../webview/renderers';

suite('Renderers Test Suite', () => {
    suite('renderAssigneeBadge', () => {
        test('should render Unassigned when no assignee', () => {
            const html = renderAssigneeBadge('123', undefined, []);

            assert.ok(html.includes('@Unassigned'), 'Should show Unassigned');
            assert.ok(html.includes('data-issue-id="123"'), 'Should include issue ID');
            assert.ok(html.includes('assignee-dropdown'), 'Should have dropdown class');
        });

        test('should render assignee name when assigned', () => {
            const assignee = { id: '5', name: 'John Doe' };
            const html = renderAssigneeBadge('123', assignee, []);

            assert.ok(html.includes('@John Doe'), 'Should show assignee name');
            assert.ok(html.includes('data-current-assignee-id="5"'), 'Should include assignee ID');
        });

        test('should include member options in dropdown', () => {
            const members = [
                { id: '1', name: 'Alice' },
                { id: '2', name: 'Bob' }
            ];
            const html = renderAssigneeBadge('123', undefined, members);

            assert.ok(html.includes('data-assignee-id="1"'), 'Should include Alice ID');
            assert.ok(html.includes('data-assignee-name="Alice"'), 'Should include Alice name');
            assert.ok(html.includes('data-assignee-id="2"'), 'Should include Bob ID');
            assert.ok(html.includes('data-assignee-name="Bob"'), 'Should include Bob name');
            assert.ok(html.includes('Unassigned'), 'Should include Unassigned option');
        });

        test('should include search input', () => {
            const html = renderAssigneeBadge('123', undefined, []);

            assert.ok(html.includes('assignee-search-input'), 'Should have search input');
            assert.ok(html.includes('filterAssigneeOptions'), 'Should have filter function');
        });

        test('should escape HTML in assignee name', () => {
            const assignee = { id: '5', name: '<script>alert("xss")</script>' };
            const html = renderAssigneeBadge('123', assignee, []);

            assert.ok(!html.includes('<script>'), 'Should escape script tags');
            assert.ok(html.includes('&lt;script&gt;'), 'Should have escaped content');
        });
    });

    suite('renderStatusBadge', () => {
        test('should render status name', () => {
            const status = { name: 'Open', is_closed: false };
            const html = renderStatusBadge('123', status, ['Open', 'Closed']);

            assert.ok(html.includes('Open'), 'Should show status name');
            assert.ok(html.includes('data-issue-id="123"'), 'Should include issue ID');
        });

        test('should include status options', () => {
            const status = { name: 'Open', is_closed: false };
            const options = ['Open', 'In Progress', 'Closed'];
            const html = renderStatusBadge('123', status, options);

            assert.ok(html.includes('data-status="Open"'), 'Should include Open option');
            assert.ok(html.includes('data-status="In Progress"'), 'Should include In Progress option');
            assert.ok(html.includes('data-status="Closed"'), 'Should include Closed option');
        });
    });

    suite('getStatusClass', () => {
        test('should return status-closed for closed status', () => {
            const status = { name: 'Closed', is_closed: true };
            assert.strictEqual(getStatusClass(status), 'status-closed');
        });

        test('should return status-in-progress for progress status', () => {
            const status = { name: 'In Progress', is_closed: false };
            assert.strictEqual(getStatusClass(status), 'status-in-progress');
        });

        test('should return status-in-progress for Japanese progress status', () => {
            const status = { name: '着手中', is_closed: false };
            assert.strictEqual(getStatusClass(status), 'status-in-progress');
        });

        test('should return status-review for review status', () => {
            const status = { name: 'In Review', is_closed: false };
            assert.strictEqual(getStatusClass(status), 'status-review');
        });

        test('should return status-blocked for blocked status', () => {
            const status = { name: 'Blocked', is_closed: false };
            assert.strictEqual(getStatusClass(status), 'status-blocked');
        });

        test('should return status-open for other statuses', () => {
            const status = { name: 'Open', is_closed: false };
            assert.strictEqual(getStatusClass(status), 'status-open');
        });
    });
});
