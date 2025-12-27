import * as assert from 'assert';
import { JSDOM, DOMWindow } from 'jsdom';
import { getScript } from '../../webview/scripts';

// Message type for postMessage calls
interface VsCodeMessage {
    command: string;
    versionId?: string;
    assigneeId?: string;
    trackerType?: string;
    searchText?: string;
    selectedStatuses?: string[];
    includeClosed?: boolean;
    hideEmptyHierarchy?: boolean;
    sortOrder?: string;
}

// Extended window type for test functions
interface TestWindow extends DOMWindow {
    applyClientFilters: () => void;
    applySorting: () => void;
    getCurrentFilterState: () => {
        versionId?: string;
        assigneeId?: string;
        trackerType?: string;
        searchText?: string;
        selectedStatuses?: string[];
        includeClosed?: boolean;
        hideEmptyHierarchy?: boolean;
        sortOrder?: string;
    };
    refresh: () => void;
    clearAllFilters: () => void;
    acquireVsCodeApi: () => { postMessage: (msg: VsCodeMessage) => void };
}

/**
 * Filter Logic Tests
 *
 * These tests verify the client-side filter logic in scripts.ts
 * by executing the generated JavaScript in a JSDOM environment.
 */
suite('Filter Logic Test Suite', () => {
    let dom: JSDOM;
    let document: Document;
    let window: TestWindow;

    // Helper to create tree item HTML
    // 注: 本番のHTML構造 (renderers.ts) を正確に再現すること
    function createTreeItem(options: {
        id: string;
        subject: string;
        type: string;
        status: string;
        assignee?: string;
    }): string {
        // 本番同様にdata属性とドロップダウン矢印を含める (renderers.ts:221-226)
        const assigneeName = options.assignee || 'Unassigned';
        const assigneeHtml = `<span class="assignee-badge" data-assignee-name="${assigneeName}">@${assigneeName}<span class="assignee-dropdown-arrow">▼</span></span>`;

        // 本番同様にdata属性とドロップダウン矢印を含める (renderers.ts:188-194)
        const statusHtml = `<span class="status-badge" data-status-name="${options.status}">${options.status}<span class="status-dropdown-arrow">▼</span></span>`;

        return `
            <div class="tree-item" data-id="${options.id}">
                <div class="tree-item-header">
                    <span class="issue-id">#${options.id}</span>
                    <span class="type-badge">${options.type}</span>
                    <span class="issue-subject">${options.subject}</span>
                    ${statusHtml}
                    ${assigneeHtml}
                </div>
            </div>
        `;
    }

    // Helper to create filter controls HTML
    // 注: 本番のHTML構造 (panel.ts) を正確に再現すること
    function createFilterControls(): string {
        return `
            <input type="text" id="searchInput" value="">
            <select id="assigneeFilter">
                <option value="">All Assignees</option>
                <option value="1">Alice</option>
                <option value="2">Bob</option>
            </select>
            <select id="trackerFilter">
                <option value="">All Types</option>
                <option value="Epic">Epic</option>
                <option value="Story">Story</option>
                <option value="Task">Task</option>
            </select>
            <input type="checkbox" id="hideEmptyHierarchy">
        `;
    }

    // Setup DOM before each test
    setup(() => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head></head>
            <body>
                <div class="container">
                    ${createFilterControls()}
                    <div id="tree">
                        ${createTreeItem({ id: '100', subject: 'Epic One', type: 'Epic', status: '未着手', assignee: 'Alice' })}
                        ${createTreeItem({ id: '101', subject: 'Feature A', type: 'Feature', status: '着手中', assignee: 'Bob' })}
                        ${createTreeItem({ id: '102', subject: 'User Story 1', type: 'Story', status: '未着手', assignee: 'Alice' })}
                        ${createTreeItem({ id: '103', subject: 'Task Alpha', type: 'Task', status: 'クローズ', assignee: 'Bob' })}
                        ${createTreeItem({ id: '104', subject: 'Bug Fix', type: 'Bug', status: '着手中' })}
                        ${createTreeItem({ id: '105', subject: 'Test Case', type: 'Test', status: '未着手', assignee: 'Alice' })}
                    </div>
                </div>
            </body>
            </html>
        `;

        dom = new JSDOM(html, {
            runScripts: 'dangerously',
            url: 'http://localhost'
        });
        document = dom.window.document;
        window = dom.window as unknown as TestWindow;

        // Mock vscode API
        window.acquireVsCodeApi = () => ({
            postMessage: () => { /* mock */ }
        });

        // Mock globalDefaultStatuses (サーバーから渡されるデフォルトステータス)
        (window as unknown as { globalDefaultStatuses: string[] }).globalDefaultStatuses = ['未着手', '着手中'];

        // Execute the script
        const script = getScript();
        const scriptEl = document.createElement('script');
        scriptEl.textContent = script;
        document.body.appendChild(scriptEl);
    });

    teardown(() => {
        dom.window.close();
    });

    suite('filterByMultipleCriteria', () => {
        test('should filter by search text (subject match)', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'Epic';

            // Call the filter function
            window.applyClientFilters();

            // Check results
            const visibleItems = document.querySelectorAll('.tree-item:not(.search-hidden)');
            const hiddenItems = document.querySelectorAll('.tree-item.search-hidden');

            assert.ok(visibleItems.length > 0, 'Should have visible items');

            // Epic One should be visible
            const epicItem = document.querySelector('.tree-item[data-id="100"]');
            assert.ok(epicItem && !epicItem.classList.contains('search-hidden'), 'Epic One should be visible');
        });

        test('should filter by ID search with # prefix', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = '#101';

            window.applyClientFilters();

            // ID 101 should be visible
            const item101 = document.querySelector('.tree-item[data-id="101"]');
            assert.ok(item101 && !item101.classList.contains('search-hidden'), 'Item 101 should be visible');

            // Other items should be hidden
            const item100 = document.querySelector('.tree-item[data-id="100"]');
            assert.ok(item100 && item100.classList.contains('search-hidden'), 'Item 100 should be hidden');
        });

        test('should filter by ID prefix match', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = '#10';

            window.applyClientFilters();

            // All items starting with 10x should be visible
            const item100 = document.querySelector('.tree-item[data-id="100"]');
            const item101 = document.querySelector('.tree-item[data-id="101"]');
            const item105 = document.querySelector('.tree-item[data-id="105"]');

            assert.ok(item100 && !item100.classList.contains('search-hidden'), 'Item 100 should be visible');
            assert.ok(item101 && !item101.classList.contains('search-hidden'), 'Item 101 should be visible');
            assert.ok(item105 && !item105.classList.contains('search-hidden'), 'Item 105 should be visible');
        });

        test('should treat numeric-only input as subject search (not ID search)', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            // 数字のみの入力は件名検索として扱う（ID検索には#が必要）
            searchInput.value = '101';

            window.applyClientFilters();

            // ID 101 exists but "101" is not in any subject, so all should be hidden
            const allItems = document.querySelectorAll('.tree-item');
            const visibleItems = document.querySelectorAll('.tree-item:not(.search-hidden)');

            assert.strictEqual(visibleItems.length, 0, 'No items should match numeric subject search');
        });

        test('should require # prefix for ID search', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;

            // Without # - should search in subject
            searchInput.value = '100';
            window.applyClientFilters();
            let item100 = document.querySelector('.tree-item[data-id="100"]');
            assert.ok(item100 && item100.classList.contains('search-hidden'), 'Without #, 100 should not match (subject search)');

            // With # - should search by ID
            searchInput.value = '#100';
            window.applyClientFilters();
            item100 = document.querySelector('.tree-item[data-id="100"]');
            assert.ok(item100 && !item100.classList.contains('search-hidden'), 'With #, 100 should match (ID search)');
        });

        test('should filter by assignee', () => {
            const assigneeFilter = document.getElementById('assigneeFilter') as HTMLSelectElement;
            assigneeFilter.value = '1'; // Alice

            window.applyClientFilters();

            // Alice's items should be visible
            const aliceItem = document.querySelector('.tree-item[data-id="100"]'); // Alice
            const bobItem = document.querySelector('.tree-item[data-id="101"]'); // Bob

            assert.ok(aliceItem && !aliceItem.classList.contains('search-hidden'), "Alice's item should be visible");
            assert.ok(bobItem && bobItem.classList.contains('search-hidden'), "Bob's item should be hidden");
        });

        test('should filter by tracker type', () => {
            const trackerFilter = document.getElementById('trackerFilter') as HTMLSelectElement;
            trackerFilter.value = 'Task';

            window.applyClientFilters();

            // Only Task type should be visible
            const taskItem = document.querySelector('.tree-item[data-id="103"]');
            const epicItem = document.querySelector('.tree-item[data-id="100"]');

            assert.ok(taskItem && !taskItem.classList.contains('search-hidden'), 'Task should be visible');
            assert.ok(epicItem && epicItem.classList.contains('search-hidden'), 'Epic should be hidden');
        });

        test('should handle multiple filters (AND logic)', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const trackerFilter = document.getElementById('trackerFilter') as HTMLSelectElement;

            searchInput.value = 'Story';
            trackerFilter.value = 'Story';

            window.applyClientFilters();

            // Only Story with "Story" in subject should match
            const storyItem = document.querySelector('.tree-item[data-id="102"]');
            const taskItem = document.querySelector('.tree-item[data-id="103"]');

            assert.ok(storyItem && !storyItem.classList.contains('search-hidden'), 'User Story 1 should be visible');
            assert.ok(taskItem && taskItem.classList.contains('search-hidden'), 'Task should be hidden');
        });

        test('should show all items when filters are cleared', () => {
            // First apply a filter
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'NonExistent';
            window.applyClientFilters();

            // All should be hidden
            let visibleItems = document.querySelectorAll('.tree-item:not(.search-hidden)');
            assert.strictEqual(visibleItems.length, 0, 'All items should be hidden');

            // Clear filter
            searchInput.value = '';
            window.applyClientFilters();

            // All should be visible
            visibleItems = document.querySelectorAll('.tree-item:not(.search-hidden)');
            assert.strictEqual(visibleItems.length, 6, 'All items should be visible');
        });
    });

    suite('Status Filter', () => {
        // Add status checkboxes dynamically for these tests
        setup(() => {
            const container = document.querySelector('.container');
            if (container) {
                const statusHtml = `
                    <div id="statusDropdown">
                        <input type="checkbox" name="statusFilter" value="未着手" checked>
                        <input type="checkbox" name="statusFilter" value="着手中" checked>
                        <input type="checkbox" name="statusFilter" value="クローズ">
                    </div>
                `;
                container.insertAdjacentHTML('afterbegin', statusHtml);
            }
        });

        test('should filter by exact status match (未着手)', () => {
            // Uncheck all except 未着手
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
            statusCheckboxes.forEach((cb) => {
                const checkbox = cb as HTMLInputElement;
                checkbox.checked = checkbox.value === '未着手';
            });

            window.applyClientFilters();

            // 未着手 items should be visible
            const item100 = document.querySelector('.tree-item[data-id="100"]'); // 未着手
            const item101 = document.querySelector('.tree-item[data-id="101"]'); // 着手中

            assert.ok(item100 && !item100.classList.contains('search-hidden'), '未着手 item should be visible');
            assert.ok(item101 && item101.classList.contains('search-hidden'), '着手中 item should be hidden');
        });

        test('should distinguish 未着手 from 着手中 (exact match)', () => {
            // Check only 着手中
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
            statusCheckboxes.forEach((cb) => {
                const checkbox = cb as HTMLInputElement;
                checkbox.checked = checkbox.value === '着手中';
            });

            window.applyClientFilters();

            // 着手中 items should be visible, 未着手 should be hidden
            const item100 = document.querySelector('.tree-item[data-id="100"]'); // 未着手
            const item101 = document.querySelector('.tree-item[data-id="101"]'); // 着手中
            const item102 = document.querySelector('.tree-item[data-id="102"]'); // 未着手

            assert.ok(item100 && item100.classList.contains('search-hidden'), '未着手 item should be hidden');
            assert.ok(item101 && !item101.classList.contains('search-hidden'), '着手中 item should be visible');
            assert.ok(item102 && item102.classList.contains('search-hidden'), '未着手 item should be hidden');
        });

        test('should allow multiple status selection (着手中 + クローズ)', () => {
            // Check both 着手中 and クローズ (non-default combination)
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
            statusCheckboxes.forEach((cb) => {
                const checkbox = cb as HTMLInputElement;
                checkbox.checked = checkbox.value === '着手中' || checkbox.value === 'クローズ';
            });

            window.applyClientFilters();

            // 着手中 and クローズ items should be visible, 未着手 should be hidden
            const item100 = document.querySelector('.tree-item[data-id="100"]'); // 未着手
            const item101 = document.querySelector('.tree-item[data-id="101"]'); // 着手中
            const item103 = document.querySelector('.tree-item[data-id="103"]'); // クローズ

            assert.ok(item100 && item100.classList.contains('search-hidden'), '未着手 should be hidden');
            assert.ok(item101 && !item101.classList.contains('search-hidden'), '着手中 should be visible');
            assert.ok(item103 && !item103.classList.contains('search-hidden'), 'クローズ should be visible');
        });

        test('should show all items when default statuses selected (未着手 + 着手中)', () => {
            // Check default statuses (未着手 and 着手中) - this is the default, so no filtering
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
            statusCheckboxes.forEach((cb) => {
                const checkbox = cb as HTMLInputElement;
                checkbox.checked = checkbox.value === '未着手' || checkbox.value === '着手中';
            });

            window.applyClientFilters();

            // Default status selection = no status filter applied = all items visible
            const allItems = document.querySelectorAll('.tree-item');
            const hiddenItems = document.querySelectorAll('.tree-item.search-hidden');

            assert.strictEqual(hiddenItems.length, 0, 'No items should be hidden with default statuses');
            assert.strictEqual(allItems.length, 6, 'All items should be present');
        });

        test('should filter クローズ status', () => {
            // Check only クローズ
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
            statusCheckboxes.forEach((cb) => {
                const checkbox = cb as HTMLInputElement;
                checkbox.checked = checkbox.value === 'クローズ';
            });

            window.applyClientFilters();

            // Only クローズ items should be visible
            const item103 = document.querySelector('.tree-item[data-id="103"]'); // クローズ
            const item100 = document.querySelector('.tree-item[data-id="100"]'); // 未着手

            assert.ok(item103 && !item103.classList.contains('search-hidden'), 'クローズ should be visible');
            assert.ok(item100 && item100.classList.contains('search-hidden'), '未着手 should be hidden');
        });
    });

    suite('Combined Filters', () => {
        setup(() => {
            const container = document.querySelector('.container');
            if (container) {
                const statusHtml = `
                    <div id="statusDropdown">
                        <input type="checkbox" name="statusFilter" value="未着手" checked>
                        <input type="checkbox" name="statusFilter" value="着手中" checked>
                        <input type="checkbox" name="statusFilter" value="クローズ">
                    </div>
                `;
                container.insertAdjacentHTML('afterbegin', statusHtml);
            }
        });

        test('should apply assignee AND status filters together', () => {
            // Set Alice as assignee filter
            const assigneeFilter = document.getElementById('assigneeFilter') as HTMLSelectElement;
            assigneeFilter.value = '1'; // Alice

            // Set only 未着手 status
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
            statusCheckboxes.forEach((cb) => {
                const checkbox = cb as HTMLInputElement;
                checkbox.checked = checkbox.value === '未着手';
            });

            window.applyClientFilters();

            // Only Alice's items with 未着手 status should be visible
            const item100 = document.querySelector('.tree-item[data-id="100"]'); // Alice, 未着手
            const item102 = document.querySelector('.tree-item[data-id="102"]'); // Alice, 未着手
            const item101 = document.querySelector('.tree-item[data-id="101"]'); // Bob, 着手中

            assert.ok(item100 && !item100.classList.contains('search-hidden'), 'Alice 未着手 should be visible');
            assert.ok(item102 && !item102.classList.contains('search-hidden'), 'Alice 未着手 should be visible');
            assert.ok(item101 && item101.classList.contains('search-hidden'), 'Bob 着手中 should be hidden');
        });

        test('should apply search AND tracker AND status filters together', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const trackerFilter = document.getElementById('trackerFilter') as HTMLSelectElement;

            searchInput.value = 'User';
            trackerFilter.value = 'Story';

            // Set only 未着手 status
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
            statusCheckboxes.forEach((cb) => {
                const checkbox = cb as HTMLInputElement;
                checkbox.checked = checkbox.value === '未着手';
            });

            window.applyClientFilters();

            // Only Story with "User" in subject and 未着手 status should match
            const item102 = document.querySelector('.tree-item[data-id="102"]'); // User Story 1, Story, 未着手
            const item103 = document.querySelector('.tree-item[data-id="103"]'); // Task Alpha, Task, クローズ

            assert.ok(item102 && !item102.classList.contains('search-hidden'), 'User Story 1 should be visible');
            assert.ok(item103 && item103.classList.contains('search-hidden'), 'Task Alpha should be hidden');
        });
    });

    suite('Edge Cases', () => {
        test('should handle empty search text', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = '';

            window.applyClientFilters();

            // All items should be visible
            const allItems = document.querySelectorAll('.tree-item');
            const hiddenItems = document.querySelectorAll('.tree-item.search-hidden');

            assert.strictEqual(hiddenItems.length, 0, 'No items should be hidden');
            assert.strictEqual(allItems.length, 6, 'All 6 items should be present');
        });

        test('should handle case-insensitive search', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'epic'; // lowercase

            window.applyClientFilters();

            // Epic One should be visible (case insensitive)
            const epicItem = document.querySelector('.tree-item[data-id="100"]');
            assert.ok(epicItem && !epicItem.classList.contains('search-hidden'), 'Epic One should be visible with lowercase search');
        });

        test('should handle special characters in search', () => {
            // Create an item with special characters
            const tree = document.getElementById('tree');
            if (tree) {
                tree.insertAdjacentHTML('beforeend', createTreeItem({
                    id: '200',
                    subject: 'Fix: Bug #123',
                    type: 'Bug',
                    status: '未着手'
                }));
            }

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'Fix:';

            window.applyClientFilters();

            const specialItem = document.querySelector('.tree-item[data-id="200"]');
            assert.ok(specialItem && !specialItem.classList.contains('search-hidden'), 'Item with special chars should be visible');
        });
    });

    suite('Unassigned Filter', () => {
        test('should show unassigned items when filtering for unassigned', () => {
            // Item 104 (Bug Fix) has no assignee
            const item104 = document.querySelector('.tree-item[data-id="104"]');
            const assigneeBadge = item104?.querySelector('.assignee-badge');

            assert.ok(assigneeBadge?.textContent?.includes('Unassigned'), 'Bug Fix should show Unassigned');
        });
    });
});

/**
 * Filter State and Refresh Tests
 *
 * These tests verify that filter state is correctly captured and
 * preserved during refresh operations.
 */
suite('Filter State and Refresh Test Suite', () => {
    let dom: JSDOM;
    let document: Document;
    let window: TestWindow;
    let postMessageCalls: VsCodeMessage[];

    // Helper to create filter controls HTML with version filter
    // 注: 本番のHTML構造 (panel.ts) を正確に再現すること
    function createFilterControlsWithVersion(): string {
        return `
            <input type="text" id="searchInput" value="">
            <select id="versionFilter">
                <option value="">All Versions</option>
                <option value="96">Sprint 2025-W51</option>
                <option value="97">Sprint 2025-W52</option>
            </select>
            <select id="assigneeFilter">
                <option value="">All Assignees</option>
                <option value="1">Alice</option>
                <option value="2">Bob</option>
            </select>
            <select id="trackerFilter">
                <option value="">All Types</option>
                <option value="Epic">Epic</option>
                <option value="Story">Story</option>
            </select>
            <input type="checkbox" id="hideEmptyHierarchy">
            <div id="statusDropdown">
                <input type="checkbox" name="statusFilter" value="未着手" checked>
                <input type="checkbox" name="statusFilter" value="着手中" checked>
                <input type="checkbox" name="statusFilter" value="クローズ">
            </div>
        `;
    }

    setup(() => {
        postMessageCalls = [];

        const html = `
            <!DOCTYPE html>
            <html>
            <head></head>
            <body>
                <div class="container">
                    ${createFilterControlsWithVersion()}
                    <div id="tree"></div>
                </div>
            </body>
            </html>
        `;

        dom = new JSDOM(html, {
            runScripts: 'dangerously',
            url: 'http://localhost'
        });
        document = dom.window.document;
        window = dom.window as unknown as TestWindow;

        // Mock vscode API with call tracking
        window.acquireVsCodeApi = () => ({
            postMessage: (msg: VsCodeMessage) => {
                postMessageCalls.push(msg);
            }
        });

        // Mock globalDefaultStatuses (サーバーから渡されるデフォルトステータス)
        (window as unknown as { globalDefaultStatuses: string[] }).globalDefaultStatuses = ['未着手', '着手中'];

        // Execute the script
        const script = getScript();
        const scriptEl = document.createElement('script');
        scriptEl.textContent = script;
        document.body.appendChild(scriptEl);
    });

    teardown(() => {
        dom.window.close();
    });

    suite('getCurrentFilterState', () => {
        test('should return empty state when no filters set', () => {
            const state = window.getCurrentFilterState();

            assert.strictEqual(state.versionId, undefined, 'versionId should be undefined');
            assert.strictEqual(state.assigneeId, undefined, 'assigneeId should be undefined');
            assert.strictEqual(state.trackerType, undefined, 'trackerType should be undefined');
            assert.strictEqual(state.searchText, undefined, 'searchText should be undefined');
        });

        test('should capture version filter', () => {
            const versionFilter = document.getElementById('versionFilter') as HTMLSelectElement;
            versionFilter.value = '96';

            const state = window.getCurrentFilterState();

            assert.strictEqual(state.versionId, '96', 'Should capture version ID');
        });

        test('should capture assignee filter', () => {
            const assigneeFilter = document.getElementById('assigneeFilter') as HTMLSelectElement;
            assigneeFilter.value = '1';

            const state = window.getCurrentFilterState();

            assert.strictEqual(state.assigneeId, '1', 'Should capture assignee ID');
        });

        test('should capture tracker filter', () => {
            const trackerFilter = document.getElementById('trackerFilter') as HTMLSelectElement;
            trackerFilter.value = 'Story';

            const state = window.getCurrentFilterState();

            assert.strictEqual(state.trackerType, 'Story', 'Should capture tracker type');
        });

        test('should capture search text', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'test query';

            const state = window.getCurrentFilterState();

            assert.strictEqual(state.searchText, 'test query', 'Should capture search text');
        });

        test('should capture status checkboxes', () => {
            // Check only クローズ
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
            statusCheckboxes.forEach((cb) => {
                const checkbox = cb as HTMLInputElement;
                checkbox.checked = checkbox.value === 'クローズ';
            });

            const state = window.getCurrentFilterState();

            assert.ok(state.selectedStatuses, 'Should have selectedStatuses');
            assert.strictEqual(state.selectedStatuses!.length, 1, 'Should have 1 status');
            assert.ok(state.selectedStatuses!.includes('クローズ'), 'Should include クローズ');
            assert.strictEqual(state.includeClosed, true, 'includeClosed should be true');
        });

        test('should capture hideEmptyHierarchy', () => {
            const hideEmptyCheckbox = document.getElementById('hideEmptyHierarchy') as HTMLInputElement;
            hideEmptyCheckbox.checked = true;

            const state = window.getCurrentFilterState();

            assert.strictEqual(state.hideEmptyHierarchy, true, 'Should capture hideEmptyHierarchy');
        });

        test('should capture all filters together', () => {
            // Set all filters
            (document.getElementById('versionFilter') as HTMLSelectElement).value = '97';
            (document.getElementById('assigneeFilter') as HTMLSelectElement).value = '2';
            (document.getElementById('trackerFilter') as HTMLSelectElement).value = 'Epic';
            (document.getElementById('searchInput') as HTMLInputElement).value = 'search term';
            (document.getElementById('hideEmptyHierarchy') as HTMLInputElement).checked = true;

            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
            statusCheckboxes.forEach((cb) => {
                const checkbox = cb as HTMLInputElement;
                checkbox.checked = checkbox.value === '着手中';
            });

            const state = window.getCurrentFilterState();

            assert.strictEqual(state.versionId, '97', 'Version should be 97');
            assert.strictEqual(state.assigneeId, '2', 'Assignee should be 2');
            assert.strictEqual(state.trackerType, 'Epic', 'Tracker should be Epic');
            assert.strictEqual(state.searchText, 'search term', 'Search should be captured');
            assert.strictEqual(state.hideEmptyHierarchy, true, 'hideEmptyHierarchy should be true');
            assert.ok(state.selectedStatuses!.includes('着手中'), 'Should include 着手中');
        });
    });

    suite('refresh with filter state', () => {
        test('should send refresh command with current filter state', () => {
            // Set some filters
            (document.getElementById('versionFilter') as HTMLSelectElement).value = '96';
            (document.getElementById('searchInput') as HTMLInputElement).value = 'test';

            // Call refresh
            window.refresh();

            // Verify postMessage was called
            assert.strictEqual(postMessageCalls.length, 1, 'Should call postMessage once');
            assert.strictEqual(postMessageCalls[0].command, 'refresh', 'Command should be refresh');
            assert.strictEqual(postMessageCalls[0].versionId, '96', 'Should include versionId');
            assert.strictEqual(postMessageCalls[0].searchText, 'test', 'Should include searchText');
        });

        test('should preserve all filter state on refresh', () => {
            // Set all filters
            (document.getElementById('versionFilter') as HTMLSelectElement).value = '97';
            (document.getElementById('assigneeFilter') as HTMLSelectElement).value = '1';
            (document.getElementById('trackerFilter') as HTMLSelectElement).value = 'Story';
            (document.getElementById('searchInput') as HTMLInputElement).value = 'query';
            (document.getElementById('hideEmptyHierarchy') as HTMLInputElement).checked = true;

            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
            statusCheckboxes.forEach((cb) => {
                const checkbox = cb as HTMLInputElement;
                checkbox.checked = checkbox.value === 'クローズ';
            });

            // Call refresh
            window.refresh();

            // Verify all filter state is preserved
            const msg = postMessageCalls[0];
            assert.strictEqual(msg.command, 'refresh');
            assert.strictEqual(msg.versionId, '97');
            assert.strictEqual(msg.assigneeId, '1');
            assert.strictEqual(msg.trackerType, 'Story');
            assert.strictEqual(msg.searchText, 'query');
            assert.strictEqual(msg.hideEmptyHierarchy, true);
            assert.ok(msg.selectedStatuses!.includes('クローズ'));
            assert.strictEqual(msg.includeClosed, true);
        });

        test('should send empty filter state when no filters set', () => {
            // No filters set, just default
            window.refresh();

            const msg = postMessageCalls[0];
            assert.strictEqual(msg.command, 'refresh');
            // Default statuses should still be included
            assert.ok(msg.selectedStatuses, 'Should include selectedStatuses');
        });
    });

    suite('clearAllFilters', () => {
        test('should reset all filter controls', () => {
            // Set non-default filters
            (document.getElementById('versionFilter') as HTMLSelectElement).value = '97';
            (document.getElementById('assigneeFilter') as HTMLSelectElement).value = '1';
            (document.getElementById('trackerFilter') as HTMLSelectElement).value = 'Story';
            (document.getElementById('searchInput') as HTMLInputElement).value = 'query';
            (document.getElementById('hideEmptyHierarchy') as HTMLInputElement).checked = false; // 非デフォルト

            // Clear all filters
            window.clearAllFilters();

            // Verify all filters are reset to default
            assert.strictEqual((document.getElementById('versionFilter') as HTMLSelectElement).value, '');
            assert.strictEqual((document.getElementById('assigneeFilter') as HTMLSelectElement).value, '');
            assert.strictEqual((document.getElementById('trackerFilter') as HTMLSelectElement).value, '');
            assert.strictEqual((document.getElementById('searchInput') as HTMLInputElement).value, '');
            // hideEmptyHierarchy のデフォルトは true
            assert.strictEqual((document.getElementById('hideEmptyHierarchy') as HTMLInputElement).checked, true);
        });

        test('should reset status checkboxes to default', () => {
            // Set non-default status
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
            statusCheckboxes.forEach((cb) => {
                const checkbox = cb as HTMLInputElement;
                checkbox.checked = checkbox.value === 'クローズ';
            });

            // Clear all filters
            window.clearAllFilters();

            // Verify default statuses are checked
            statusCheckboxes.forEach((cb) => {
                const checkbox = cb as HTMLInputElement;
                if (checkbox.value === '未着手' || checkbox.value === '着手中') {
                    assert.strictEqual(checkbox.checked, true, `${checkbox.value} should be checked`);
                } else {
                    assert.strictEqual(checkbox.checked, false, `${checkbox.value} should not be checked`);
                }
            });
        });
    });

    suite('sortOrder in filter state', () => {
        setup(() => {
            // Add sort dropdown
            const container = document.querySelector('.container');
            if (container) {
                const sortHtml = `
                    <select id="sortOrder">
                        <option value="id_asc">ID ↑</option>
                        <option value="id_desc">ID ↓</option>
                        <option value="name_asc">Name ↑</option>
                        <option value="name_desc">Name ↓</option>
                    </select>
                `;
                container.insertAdjacentHTML('afterbegin', sortHtml);
            }
        });

        test('should capture sortOrder in getCurrentFilterState', () => {
            const sortOrder = document.getElementById('sortOrder') as HTMLSelectElement;
            sortOrder.value = 'name_desc';

            const state = window.getCurrentFilterState();

            assert.strictEqual(state.sortOrder, 'name_desc', 'Should capture sort order');
        });

        test('should default to id_asc when sortOrder not set', () => {
            const state = window.getCurrentFilterState();

            assert.strictEqual(state.sortOrder, 'id_asc', 'Default sort order should be id_asc');
        });

        test('should include sortOrder in refresh message', () => {
            const sortOrder = document.getElementById('sortOrder') as HTMLSelectElement;
            sortOrder.value = 'id_desc';

            window.refresh();

            const msg = postMessageCalls[0];
            assert.strictEqual(msg.sortOrder, 'id_desc', 'Refresh should include sortOrder');
        });
    });
});

/**
 * Sorting Tests
 *
 * These tests verify the sorting functionality in scripts.ts
 */
suite('Sorting Test Suite', () => {
    let dom: JSDOM;
    let document: Document;
    let window: TestWindow;

    // Helper to create tree item HTML with specific IDs for sorting tests
    function createSortableTreeItem(options: {
        id: string;
        subject: string;
    }): string {
        return `
            <div class="tree-item" data-id="${options.id}">
                <div class="tree-item-header">
                    <span class="issue-id">#${options.id}</span>
                    <span class="issue-subject">${options.subject}</span>
                </div>
            </div>
        `;
    }

    setup(() => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head></head>
            <body>
                <div class="container">
                    <select id="sortOrder">
                        <option value="id_asc">ID ↑</option>
                        <option value="id_desc">ID ↓</option>
                        <option value="name_asc">Name ↑</option>
                        <option value="name_desc">Name ↓</option>
                        <option value="version_asc">Due ↑</option>
                        <option value="version_desc">Due ↓</option>
                    </select>
                    <div class="tree-container">
                        ${createSortableTreeItem({ id: '103', subject: 'Charlie Task' })}
                        ${createSortableTreeItem({ id: '101', subject: 'Alpha Task' })}
                        ${createSortableTreeItem({ id: '102', subject: 'Bravo Task' })}
                    </div>
                </div>
            </body>
            </html>
        `;

        dom = new JSDOM(html, {
            runScripts: 'dangerously',
            url: 'http://localhost'
        });
        document = dom.window.document;
        window = dom.window as unknown as TestWindow;

        // Mock vscode API
        window.acquireVsCodeApi = () => ({
            postMessage: () => { /* mock */ }
        });

        // Mock globalDefaultStatuses
        (window as unknown as { globalDefaultStatuses: string[] }).globalDefaultStatuses = ['未着手', '着手中'];

        // Execute the script
        const script = getScript();
        const scriptEl = document.createElement('script');
        scriptEl.textContent = script;
        document.body.appendChild(scriptEl);
    });

    teardown(() => {
        dom.window.close();
    });

    suite('applySorting', () => {
        test('should sort by ID ascending', () => {
            const sortOrder = document.getElementById('sortOrder') as HTMLSelectElement;
            sortOrder.value = 'id_asc';

            window.applySorting();

            const container = document.querySelector('.tree-container');
            const items = container?.querySelectorAll('.tree-item');

            assert.ok(items && items.length === 3, 'Should have 3 items');

            const ids = Array.from(items!).map(item =>
                item.querySelector('.issue-id')?.textContent?.replace('#', '')
            );

            assert.deepStrictEqual(ids, ['101', '102', '103'], 'Items should be sorted by ID ascending');
        });

        test('should sort by ID descending', () => {
            const sortOrder = document.getElementById('sortOrder') as HTMLSelectElement;
            sortOrder.value = 'id_desc';

            window.applySorting();

            const container = document.querySelector('.tree-container');
            const items = container?.querySelectorAll('.tree-item');
            const ids = Array.from(items!).map(item =>
                item.querySelector('.issue-id')?.textContent?.replace('#', '')
            );

            assert.deepStrictEqual(ids, ['103', '102', '101'], 'Items should be sorted by ID descending');
        });

        test('should sort by name ascending', () => {
            const sortOrder = document.getElementById('sortOrder') as HTMLSelectElement;
            sortOrder.value = 'name_asc';

            window.applySorting();

            const container = document.querySelector('.tree-container');
            const items = container?.querySelectorAll('.tree-item');
            const subjects = Array.from(items!).map(item =>
                item.querySelector('.issue-subject')?.textContent
            );

            assert.deepStrictEqual(subjects, ['Alpha Task', 'Bravo Task', 'Charlie Task'], 'Items should be sorted by name ascending');
        });

        test('should sort by name descending', () => {
            const sortOrder = document.getElementById('sortOrder') as HTMLSelectElement;
            sortOrder.value = 'name_desc';

            window.applySorting();

            const container = document.querySelector('.tree-container');
            const items = container?.querySelectorAll('.tree-item');
            const subjects = Array.from(items!).map(item =>
                item.querySelector('.issue-subject')?.textContent
            );

            assert.deepStrictEqual(subjects, ['Charlie Task', 'Bravo Task', 'Alpha Task'], 'Items should be sorted by name descending');
        });

        test('should apply sorting after client filter', () => {
            // Set sort order before filtering
            const sortOrder = document.getElementById('sortOrder') as HTMLSelectElement;
            sortOrder.value = 'name_asc';

            // Apply client filters (which should call applySorting at the end)
            window.applyClientFilters();

            const container = document.querySelector('.tree-container');
            const items = container?.querySelectorAll('.tree-item:not(.search-hidden)');
            const subjects = Array.from(items!).map(item =>
                item.querySelector('.issue-subject')?.textContent
            );

            assert.deepStrictEqual(subjects, ['Alpha Task', 'Bravo Task', 'Charlie Task'], 'Items should be sorted after filtering');
        });
    });

    suite('sort within hierarchy', () => {
        setup(() => {
            // Add nested tree structure
            const container = document.querySelector('.tree-container');
            if (container) {
                container.innerHTML = `
                    <div class="tree-item" data-id="1">
                        <div class="tree-item-header">
                            <span class="issue-id">#1</span>
                            <span class="issue-subject">Epic</span>
                        </div>
                        <div class="tree-children">
                            ${createSortableTreeItem({ id: '13', subject: 'Zebra Feature' })}
                            ${createSortableTreeItem({ id: '11', subject: 'Alpha Feature' })}
                            ${createSortableTreeItem({ id: '12', subject: 'Beta Feature' })}
                        </div>
                    </div>
                `;
            }
        });

        test('should sort children within their container', () => {
            const sortOrder = document.getElementById('sortOrder') as HTMLSelectElement;
            sortOrder.value = 'name_asc';

            window.applySorting();

            const childrenContainer = document.querySelector('.tree-children');
            const items = childrenContainer?.querySelectorAll(':scope > .tree-item');
            const subjects = Array.from(items!).map(item =>
                item.querySelector('.issue-subject')?.textContent
            );

            assert.deepStrictEqual(subjects, ['Alpha Feature', 'Beta Feature', 'Zebra Feature'], 'Children should be sorted within hierarchy');
        });

        test('should sort by ID within hierarchy', () => {
            const sortOrder = document.getElementById('sortOrder') as HTMLSelectElement;
            sortOrder.value = 'id_desc';

            window.applySorting();

            const childrenContainer = document.querySelector('.tree-children');
            const items = childrenContainer?.querySelectorAll(':scope > .tree-item');
            const ids = Array.from(items!).map(item =>
                item.querySelector('.issue-id')?.textContent?.replace('#', '')
            );

            assert.deepStrictEqual(ids, ['13', '12', '11'], 'Children should be sorted by ID within hierarchy');
        });
    });

    suite('version (due date) sorting', () => {
        setup(() => {
            // Add tree items with version dates
            const container = document.querySelector('.tree-container');
            if (container) {
                container.innerHTML = `
                    <div class="tree-item" data-id="101" data-version-date="2025-12-29">
                        <div class="tree-item-header">
                            <span class="issue-id">#101</span>
                            <span class="issue-subject">Sprint W52 Task</span>
                        </div>
                    </div>
                    <div class="tree-item" data-id="102" data-version-date="2025-12-22">
                        <div class="tree-item-header">
                            <span class="issue-id">#102</span>
                            <span class="issue-subject">Sprint W51 Task</span>
                        </div>
                    </div>
                    <div class="tree-item" data-id="103">
                        <div class="tree-item-header">
                            <span class="issue-id">#103</span>
                            <span class="issue-subject">No Version Task</span>
                        </div>
                    </div>
                    <div class="tree-item" data-id="104" data-version-date="2025-12-15">
                        <div class="tree-item-header">
                            <span class="issue-id">#104</span>
                            <span class="issue-subject">Sprint W50 Task</span>
                        </div>
                    </div>
                `;
            }
        });

        test('should sort by version date ascending', () => {
            const sortOrder = document.getElementById('sortOrder') as HTMLSelectElement;
            sortOrder.value = 'version_asc';

            window.applySorting();

            const container = document.querySelector('.tree-container');
            const items = container?.querySelectorAll('.tree-item');
            const ids = Array.from(items!).map(item => item.getAttribute('data-id'));

            // W50 (12-15) -> W51 (12-22) -> W52 (12-29) -> No version (末尾)
            assert.deepStrictEqual(ids, ['104', '102', '101', '103'], 'Items should be sorted by version date ascending');
        });

        test('should sort by version date descending', () => {
            const sortOrder = document.getElementById('sortOrder') as HTMLSelectElement;
            sortOrder.value = 'version_desc';

            window.applySorting();

            const container = document.querySelector('.tree-container');
            const items = container?.querySelectorAll('.tree-item');
            const ids = Array.from(items!).map(item => item.getAttribute('data-id'));

            // No version (9999-12-31 reversed = first) -> W52 -> W51 -> W50
            assert.deepStrictEqual(ids, ['103', '101', '102', '104'], 'Items should be sorted by version date descending');
        });

        test('should place items without version date at the end when ascending', () => {
            const sortOrder = document.getElementById('sortOrder') as HTMLSelectElement;
            sortOrder.value = 'version_asc';

            window.applySorting();

            const container = document.querySelector('.tree-container');
            const items = container?.querySelectorAll('.tree-item');
            const lastItem = items![items!.length - 1];

            assert.strictEqual(lastItem.getAttribute('data-id'), '103', 'Item without version should be at the end');
            assert.ok(!lastItem.hasAttribute('data-version-date') || lastItem.getAttribute('data-version-date') === '', 'Last item should not have version date');
        });
    });
});
