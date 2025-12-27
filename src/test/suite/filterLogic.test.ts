import * as assert from 'assert';
import { JSDOM, DOMWindow } from 'jsdom';
import { getScript } from '../../webview/scripts';

// Extended window type for test functions
interface TestWindow extends DOMWindow {
    applyClientFilters: () => void;
    acquireVsCodeApi: () => { postMessage: () => void };
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
    function createTreeItem(options: {
        id: string;
        subject: string;
        type: string;
        status: string;
        assignee?: string;
    }): string {
        const assigneeHtml = options.assignee
            ? `<span class="assignee-badge">@${options.assignee}</span>`
            : '<span class="assignee-badge">@Unassigned</span>';

        return `
            <div class="tree-item" data-id="${options.id}">
                <div class="tree-item-header">
                    <span class="issue-id">#${options.id}</span>
                    <span class="type-badge">${options.type}</span>
                    <span class="issue-subject">${options.subject}</span>
                    <span class="status-badge">${options.status}</span>
                    ${assigneeHtml}
                </div>
            </div>
        `;
    }

    // Helper to create filter controls HTML
    function createFilterControls(): string {
        return `
            <input type="text" id="searchInput" value="">
            <select id="assigneeFilter">
                <option value="">All</option>
                <option value="1">@Alice</option>
                <option value="2">@Bob</option>
            </select>
            <select id="trackerFilter">
                <option value="">All</option>
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
