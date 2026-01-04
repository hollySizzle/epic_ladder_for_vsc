import * as assert from 'assert';
import {
    renderAssigneeBadge,
    renderStatusBadge,
    getStatusClass,
    renderActiveFilterBadges,
    AssigneeInfo
} from '../../webview/renderers';
import { RedmineVersion } from '../../types';

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

        test('should return status-closed for closed name when is_closed is undefined', () => {
            const status = { name: 'クローズ' };
            assert.strictEqual(getStatusClass(status), 'status-closed');
        });

        test('should return status-in-progress for progress name when is_closed is undefined', () => {
            const status = { name: '着手中' };
            assert.strictEqual(getStatusClass(status), 'status-in-progress');
        });

        test('should return status-open for Open name when is_closed is undefined', () => {
            const status = { name: 'Open' };
            assert.strictEqual(getStatusClass(status), 'status-open');
        });
    });

    suite('renderActiveFilterBadges', () => {
        const versions: RedmineVersion[] = [
            { id: '96', name: 'Sprint 2025-W51', status: 'open', effective_date: '2025-12-22' },
            { id: '97', name: 'Sprint 2025-W52', status: 'open', effective_date: '2025-12-29' }
        ];
        const assignees: AssigneeInfo[] = [
            { id: '5', name: 'John Doe' },
            { id: '6', name: 'Jane Smith' }
        ];
        const defaultStatuses = ['未着手', '着手中'];

        test('should return empty string when no filter options', () => {
            const result = renderActiveFilterBadges(undefined, versions, assignees, defaultStatuses);
            assert.strictEqual(result, '');
        });

        test('should return empty string when filter options is empty', () => {
            const result = renderActiveFilterBadges({}, versions, assignees, defaultStatuses);
            assert.strictEqual(result, '');
        });

        test('should render search text badge', () => {
            const result = renderActiveFilterBadges(
                { searchText: 'test query' },
                versions,
                assignees,
                defaultStatuses
            );
            assert.ok(result.includes('Search:'), 'Should include Search label');
            assert.ok(result.includes('test query'), 'Should include search text');
            assert.ok(result.includes('data-filter="search"'), 'Should have search filter data attr');
            assert.ok(result.includes('clearFilter'), 'Should have clear function');
        });

        test('should render version badge with name', () => {
            const result = renderActiveFilterBadges(
                { versionId: '96' },
                versions,
                assignees,
                defaultStatuses
            );
            assert.ok(result.includes('Version:'), 'Should include Version label');
            assert.ok(result.includes('Sprint 2025-W51'), 'Should include version name');
            assert.ok(result.includes('data-filter="version"'), 'Should have version filter data attr');
        });

        test('should render assignee badge with name', () => {
            const result = renderActiveFilterBadges(
                { assigneeId: '5' },
                versions,
                assignees,
                defaultStatuses
            );
            assert.ok(result.includes('Assignee:'), 'Should include Assignee label');
            assert.ok(result.includes('John Doe'), 'Should include assignee name');
            assert.ok(result.includes('data-filter="assignee"'), 'Should have assignee filter data attr');
        });

        test('should render tracker type badge', () => {
            const result = renderActiveFilterBadges(
                { trackerType: 'Bug' },
                versions,
                assignees,
                defaultStatuses
            );
            assert.ok(result.includes('Type:'), 'Should include Type label');
            assert.ok(result.includes('Bug'), 'Should include tracker type');
            assert.ok(result.includes('data-filter="tracker"'), 'Should have tracker filter data attr');
        });

        test('should NOT render badge when hideEmptyHierarchy is true (default)', () => {
            const result = renderActiveFilterBadges(
                { hideEmptyHierarchy: true },
                versions,
                assignees,
                defaultStatuses
            );
            // hideEmptyHierarchy のデフォルトは true なのでバッジは表示しない
            assert.strictEqual(result, '', 'Should not render badge for default hideEmptyHierarchy');
        });

        test('should NOT render status badge when using default statuses', () => {
            const result = renderActiveFilterBadges(
                { selectedStatuses: ['未着手', '着手中'] },
                versions,
                assignees,
                defaultStatuses
            );
            assert.ok(!result.includes('Status:'), 'Should not show status badge for default');
        });

        test('should render status badge when using non-default statuses', () => {
            const result = renderActiveFilterBadges(
                { selectedStatuses: ['クローズ'] },
                versions,
                assignees,
                defaultStatuses
            );
            assert.ok(result.includes('Status:'), 'Should include Status label');
            assert.ok(result.includes('クローズ'), 'Should include status name');
            assert.ok(result.includes('data-filter="status"'), 'Should have status filter data attr');
        });

        test('should render multiple badges', () => {
            const result = renderActiveFilterBadges(
                {
                    searchText: 'query',
                    versionId: '97',
                    assigneeId: '6'
                },
                versions,
                assignees,
                defaultStatuses
            );
            assert.ok(result.includes('Search:'), 'Should include Search');
            assert.ok(result.includes('Version:'), 'Should include Version');
            assert.ok(result.includes('Assignee:'), 'Should include Assignee');
        });

        test('should escape HTML in filter values', () => {
            const result = renderActiveFilterBadges(
                { searchText: '<script>alert("xss")</script>' },
                versions,
                assignees,
                defaultStatuses
            );
            assert.ok(!result.includes('<script>'), 'Should escape script tags');
            assert.ok(result.includes('&lt;script&gt;'), 'Should have escaped content');
        });
    });
});
