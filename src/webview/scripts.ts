/**
 * JavaScript code for the Epic Ladder webview
 */
export function getScript(): string {
    return `
        const vscode = acquireVsCodeApi();
        let searchTimeout;
        let filtersCollapsed = true;

        function refresh() {
            // フィルタ状態を保持してリフレッシュ
            const currentFilters = getCurrentFilterState();
            vscode.postMessage({ command: 'refresh', ...currentFilters });
        }

        function getCurrentFilterState() {
            const versionFilter = document.getElementById('versionFilter');
            const assigneeFilter = document.getElementById('assigneeFilter');
            const trackerFilter = document.getElementById('trackerFilter');
            const searchInput = document.getElementById('searchInput');
            const hideEmptyCheckbox = document.getElementById('hideEmptyHierarchy');
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]:checked');

            const selectedStatuses = Array.from(statusCheckboxes).map(cb => cb.value);
            const includesClosed = selectedStatuses.includes('クローズ');

            return {
                versionId: versionFilter?.value || undefined,
                assigneeId: assigneeFilter?.value || undefined,
                trackerType: trackerFilter?.value || undefined,
                searchText: searchInput?.value || undefined,
                selectedStatuses: selectedStatuses,
                includeClosed: includesClosed,
                hideEmptyHierarchy: hideEmptyCheckbox?.checked || false
            };
        }

        function toggleFilters() {
            const filtersPanel = document.getElementById('filtersPanel');
            if (filtersPanel) {
                filtersCollapsed = !filtersCollapsed;
                filtersPanel.classList.toggle('collapsed', filtersCollapsed);
            }
        }

        // Initialize filters state on narrow screens
        function initFilters() {
            const container = document.querySelector('.container');
            if (container && container.offsetWidth <= 500) {
                const filtersPanel = document.getElementById('filtersPanel');
                if (filtersPanel) {
                    filtersPanel.classList.add('collapsed');
                }
            } else {
                filtersCollapsed = false;
            }
        }

        // Run on load
        initFilters();

        // ========================================
        // Status Filter Multiselect Dropdown
        // ========================================
        let statusFilterMenuOpen = false;

        function toggleStatusFilterDropdown() {
            const menu = document.getElementById('statusFilterMenu');
            if (!menu) return;

            statusFilterMenuOpen = !statusFilterMenuOpen;
            menu.classList.toggle('open', statusFilterMenuOpen);
        }

        function closeStatusFilterDropdown() {
            const menu = document.getElementById('statusFilterMenu');
            if (menu) {
                menu.classList.remove('open');
                statusFilterMenuOpen = false;
            }
        }

        function onStatusFilterChange() {
            // Update dropdown button text
            const checkboxes = document.querySelectorAll('input[name="statusFilter"]:checked');
            const selectedValues = Array.from(checkboxes).map(cb => cb.value);
            const textEl = document.querySelector('.multiselect-text');
            if (textEl) {
                textEl.textContent = selectedValues.length > 0 ? selectedValues.join(', ') : 'Select...';
            }
            // Apply filter
            applyClientFilters();
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            const dropdown = document.getElementById('statusDropdown');
            if (dropdown && !dropdown.contains(event.target)) {
                closeStatusFilterDropdown();
            }
        });

        // ========================================
        // Search Shortcuts (/, Cmd+F, Ctrl+F)
        // ========================================
        function focusSearchInput() {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                // Expand filters panel if collapsed (narrow screen)
                const filtersPanel = document.getElementById('filtersPanel');
                if (filtersPanel && filtersPanel.classList.contains('collapsed')) {
                    filtersPanel.classList.remove('collapsed');
                    filtersCollapsed = false;
                }
                searchInput.focus();
                searchInput.select();
            }
        }

        document.addEventListener('keydown', function(event) {
            // Skip if user is already typing in an input
            const activeElement = document.activeElement;
            const isTyping = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.tagName === 'SELECT'
            );

            // "/" key - focus search when not typing
            if (event.key === '/' && !isTyping) {
                event.preventDefault();
                focusSearchInput();
                return;
            }

            // Cmd+F (Mac) or Ctrl+F (Windows/Linux) - always focus search
            if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
                event.preventDefault();
                focusSearchInput();
                return;
            }

            // Escape key - close UI elements in priority order
            if (event.key === 'Escape') {
                // 1. Modal is handled by its own handler (handleModalKeydown)
                const modal = document.getElementById('commentsModal');
                if (modal && modal.classList.contains('open')) {
                    return; // Let modal handler deal with it
                }

                // 2. Close status filter dropdown
                if (statusFilterMenuOpen) {
                    closeStatusFilterDropdown();
                    event.preventDefault();
                    return;
                }

                // 3. Close status/assignee dropdowns
                if (currentOpenStatusMenu) {
                    currentOpenStatusMenu.classList.remove('open');
                    currentOpenStatusMenu = null;
                    event.preventDefault();
                    return;
                }
                if (currentOpenAssigneeMenu) {
                    currentOpenAssigneeMenu.classList.remove('open');
                    currentOpenAssigneeMenu = null;
                    event.preventDefault();
                    return;
                }

                // 4. If typing, blur the input
                if (isTyping) {
                    activeElement.blur();
                    event.preventDefault();
                    return;
                }

                // 5. Close filters panel (narrow width)
                const filtersPanel = document.getElementById('filtersPanel');
                if (filtersPanel && !filtersPanel.classList.contains('collapsed')) {
                    filtersPanel.classList.add('collapsed');
                    filtersCollapsed = true;
                    event.preventDefault();
                    return;
                }
            }
        });

        // ========================================
        // Status Dropdown Functions
        // ========================================
        let currentOpenStatusMenu = null;

        function toggleStatusDropdown(event, issueId) {
            event.stopPropagation();

            const menu = document.getElementById('statusMenu-' + issueId);
            if (!menu) return;

            // Close any other open menu
            if (currentOpenStatusMenu && currentOpenStatusMenu !== menu) {
                currentOpenStatusMenu.classList.remove('open');
            }

            // Toggle current menu
            const isOpen = menu.classList.toggle('open');
            currentOpenStatusMenu = isOpen ? menu : null;

            // Add click handlers to options
            if (isOpen) {
                menu.querySelectorAll('.status-option').forEach(option => {
                    option.onclick = function(e) {
                        e.stopPropagation();
                        const statusName = this.getAttribute('data-status');
                        updateStatus(issueId, statusName);
                        menu.classList.remove('open');
                        currentOpenStatusMenu = null;
                    };
                });
            }
        }

        function updateStatus(issueId, statusName) {
            // Find the status badge and show loading state
            const dropdown = document.querySelector('.status-dropdown[data-issue-id="' + issueId + '"]');
            const badge = dropdown?.querySelector('.status-badge');

            if (badge) {
                badge.classList.add('status-updating');
            }

            vscode.postMessage({
                command: 'updateStatus',
                issueId: issueId,
                statusName: statusName
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            if (currentOpenStatusMenu && !event.target.closest('.status-dropdown')) {
                currentOpenStatusMenu.classList.remove('open');
                currentOpenStatusMenu = null;
            }
            if (currentOpenAssigneeMenu && !event.target.closest('.assignee-dropdown')) {
                currentOpenAssigneeMenu.classList.remove('open');
                currentOpenAssigneeMenu = null;
            }
        });

        // ========================================
        // Assignee Dropdown Functions
        // ========================================
        let currentOpenAssigneeMenu = null;

        function toggleAssigneeDropdown(event, issueId) {
            event.stopPropagation();

            const menu = document.getElementById('assigneeMenu-' + issueId);
            if (!menu) return;

            // Close any other open menu
            if (currentOpenAssigneeMenu && currentOpenAssigneeMenu !== menu) {
                currentOpenAssigneeMenu.classList.remove('open');
            }
            if (currentOpenStatusMenu) {
                currentOpenStatusMenu.classList.remove('open');
                currentOpenStatusMenu = null;
            }

            // Toggle current menu
            const isOpen = menu.classList.toggle('open');
            currentOpenAssigneeMenu = isOpen ? menu : null;

            // Reset search and focus
            if (isOpen) {
                const searchInput = menu.querySelector('.assignee-search-input');
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                    filterAssigneeOptions(searchInput, issueId);
                }

                // Add click handlers to options
                menu.querySelectorAll('.assignee-option').forEach(option => {
                    option.onclick = function(e) {
                        e.stopPropagation();
                        const assigneeId = this.getAttribute('data-assignee-id');
                        const assigneeName = this.getAttribute('data-assignee-name');
                        updateAssignee(issueId, assigneeId, assigneeName);
                        menu.classList.remove('open');
                        currentOpenAssigneeMenu = null;
                    };
                });
            }
        }

        function filterAssigneeOptions(input, issueId) {
            const menu = document.getElementById('assigneeMenu-' + issueId);
            if (!menu) return;

            const searchText = input.value.toLowerCase();
            const options = menu.querySelectorAll('.assignee-option');

            options.forEach(option => {
                const name = option.getAttribute('data-assignee-name').toLowerCase();
                if (name.includes(searchText)) {
                    option.style.display = '';
                } else {
                    option.style.display = 'none';
                }
            });
        }

        function updateAssignee(issueId, assigneeId, assigneeName) {
            // Find the assignee badge and show loading state
            const dropdown = document.querySelector('.assignee-dropdown[data-issue-id="' + issueId + '"]');
            const badge = dropdown?.querySelector('.assignee-badge');

            if (badge) {
                badge.classList.add('assignee-updating');
            }

            vscode.postMessage({
                command: 'updateAssignee',
                issueId: issueId,
                assigneeId: assigneeId,
                assigneeName: assigneeName
            });
        }

        function toggleCollapse(header) {
            const item = header.closest('.tree-item');
            if (item) {
                item.classList.toggle('collapsed');
            }
        }

        // IDクリックでブラウザで開く（詳細取得してURLを使用）
        function openIssueInBrowser(issueId) {
            // キャッシュにあればそのURLを使用
            if (detailCache[issueId] && detailCache[issueId].issue && detailCache[issueId].issue.url) {
                openInBrowser(detailCache[issueId].issue.url);
                return;
            }
            // なければ詳細を取得してから開く
            vscode.postMessage({ command: 'openIssueInBrowser', issueId: issueId });
        }

        // URLをクリップボードにコピー
        function copyIssueUrl(issueId) {
            // キャッシュにあればそのURLを使用
            if (detailCache[issueId] && detailCache[issueId].issue && detailCache[issueId].issue.url) {
                copyToClipboard(detailCache[issueId].issue.url, issueId);
                return;
            }
            // なければ詳細を取得してからコピー
            vscode.postMessage({ command: 'copyIssueUrl', issueId: issueId });
        }

        function copyToClipboard(text, issueId) {
            navigator.clipboard.writeText(text).then(() => {
                showCopyFeedback(issueId);
            }).catch(err => {
                console.error('Failed to copy URL:', err);
            });
        }

        function showCopyFeedback(issueId) {
            // Find the copy button for this issue and show feedback
            const treeItem = document.querySelector('.tree-item[data-id="' + issueId + '"]');
            const copyBtn = treeItem?.querySelector('.copy-url-btn');
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓';
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.classList.remove('copied');
                }, 1500);
            }
        }

        // モーダル用URLコピー
        function copyModalIssueUrl(url, issueId) {
            navigator.clipboard.writeText(url).then(() => {
                showModalCopyFeedback();
            }).catch(err => {
                console.error('Failed to copy URL:', err);
            });
        }

        function showModalCopyFeedback() {
            const copyBtn = document.querySelector('.modal-copy-btn');
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓';
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.classList.remove('copied');
                }, 1500);
            }
        }

        function applyFilters() {
            const versionId = document.getElementById('versionFilter').value;
            const searchText = document.getElementById('searchInput').value;

            // ステータスチェックボックスの値を取得
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]:checked');
            const selectedStatuses = Array.from(statusCheckboxes).map(cb => cb.value);
            const includesClosed = selectedStatuses.includes('クローズ');

            vscode.postMessage({
                command: 'filter',
                versionId: versionId || undefined,
                includeClosed: includesClosed,
                searchText: searchText,
                selectedStatuses: selectedStatuses
            });
        }

        function applyClientFilters() {
            const searchText = document.getElementById('searchInput').value;
            const assigneeId = document.getElementById('assigneeFilter').value;
            const trackerType = document.getElementById('trackerFilter').value;
            const hideEmptyCheckbox = document.getElementById('hideEmptyHierarchy');
            const hideEmptyHierarchy = hideEmptyCheckbox?.checked || false;

            // ステータスチェックボックスの値を取得
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]:checked');
            const selectedStatuses = Array.from(statusCheckboxes).map(cb => cb.value);

            filterByMultipleCriteria(searchText, assigneeId, trackerType, selectedStatuses, hideEmptyHierarchy);
        }

        function debounceSearch(value) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                applyClientFilters();
            }, 300);
        }

        function filterByMultipleCriteria(searchText, assigneeId, trackerType, selectedStatuses, hideEmptyHierarchy) {
            const items = document.querySelectorAll('.tree-item');
            const searchLower = (searchText || '').toLowerCase();
            const defaultStatuses = ['未着手', '着手中'];
            const hasStatusFilter = selectedStatuses &&
                (selectedStatuses.length !== defaultStatuses.length ||
                 !defaultStatuses.every(s => selectedStatuses.includes(s)));

            // Reset all items first
            items.forEach(item => {
                item.classList.remove('search-hidden', 'search-match');
            });

            // Apply individual filters
            const hasFilters = searchText || assigneeId || trackerType || hasStatusFilter;

            if (hasFilters) {
                items.forEach(item => {
                    let matches = true;

                    // Check search text
                    if (searchText) {
                        // #で始まる場合はID検索モード
                        if (searchText.startsWith('#')) {
                            const searchId = searchText.slice(1);
                            const idElem = item.querySelector('.issue-id');
                            const issueId = (idElem?.textContent || '').replace('#', '');
                            // ID前方一致
                            if (!issueId.startsWith(searchId)) {
                                matches = false;
                            }
                        } else {
                            // 通常のテキスト検索（件名に含む）
                            const subject = item.querySelector('.issue-subject');
                            const subjectText = (subject?.textContent || '').toLowerCase();
                            if (!subjectText.includes(searchLower)) {
                                matches = false;
                            }
                        }
                    }

                    // Check assignee
                    if (matches && assigneeId) {
                        const assigneeElem = item.querySelector('.assignee');
                        const itemAssignee = assigneeElem?.textContent || '';
                        // Get selected assignee name from dropdown
                        const assigneeSelect = document.getElementById('assigneeFilter');
                        const selectedAssigneeName = assigneeSelect.options[assigneeSelect.selectedIndex]?.text || '';
                        if (!itemAssignee.includes(selectedAssigneeName.replace('@', ''))) {
                            matches = false;
                        }
                    }

                    // Check tracker type
                    if (matches && trackerType) {
                        const typeBadge = item.querySelector('.type-badge');
                        const itemType = typeBadge?.textContent?.trim() || '';
                        if (itemType.toLowerCase() !== trackerType.toLowerCase()) {
                            matches = false;
                        }
                    }

                    // Check status (マルチセレクト対応)
                    if (matches && selectedStatuses && selectedStatuses.length > 0) {
                        const statusBadge = item.querySelector('.status-badge');
                        const itemStatus = statusBadge?.textContent?.replace('▼', '').trim() || '';
                        if (!selectedStatuses.some(status => itemStatus.includes(status))) {
                            matches = false;
                        }
                    }

                    if (matches) {
                        item.classList.remove('search-hidden');
                        if (searchText) {
                            item.classList.add('search-match');
                        }
                        // Expand parent items
                        let parent = item.parentElement?.closest('.tree-item');
                        while (parent) {
                            parent.classList.remove('collapsed', 'search-hidden');
                            parent = parent.parentElement?.closest('.tree-item');
                        }
                    } else {
                        item.classList.add('search-hidden');
                        item.classList.remove('search-match');
                    }
                });

                // Show parent items that have visible children
                items.forEach(item => {
                    if (item.classList.contains('search-hidden')) {
                        const hasVisibleChild = item.querySelector('.tree-item:not(.search-hidden)');
                        if (hasVisibleChild) {
                            item.classList.remove('search-hidden');
                        }
                    }
                });
            }

            // 空の階層を非表示にする処理
            if (hideEmptyHierarchy) {
                hideEmptyHierarchyItems();
            }
        }

        // フィルタ後にUserStoryを持たないEpic/Featureを非表示にする
        function hideEmptyHierarchyItems() {
            const items = document.querySelectorAll('.tree-item');

            // ボトムアップで処理（深い階層から順に）
            // まず全てのアイテムを配列に変換し、深さでソート
            const itemsArray = Array.from(items);

            // 各アイテムの深さを計算
            function getDepth(item) {
                let depth = 0;
                let parent = item.parentElement?.closest('.tree-item');
                while (parent) {
                    depth++;
                    parent = parent.parentElement?.closest('.tree-item');
                }
                return depth;
            }

            // 深さでソート（深い順）
            itemsArray.sort((a, b) => getDepth(b) - getDepth(a));

            // 各アイテムについて、表示中のUserStoryがあるかチェック
            itemsArray.forEach(item => {
                if (item.classList.contains('search-hidden')) return;

                const typeBadge = item.querySelector(':scope > .tree-item-header .type-badge');
                const itemType = typeBadge?.textContent?.trim().toLowerCase() || '';

                // Epic または Feature の場合のみチェック
                if (itemType === 'epic' || itemType === 'feature') {
                    // 直下または子孫に表示中のStory/Task/Bug/Testがあるか
                    const hasVisibleUserStoryOrDescendant = item.querySelector(
                        '.tree-item:not(.search-hidden) .type-badge'
                    );

                    if (!hasVisibleUserStoryOrDescendant) {
                        // 表示中の子要素がない場合は非表示
                        item.classList.add('search-hidden');
                    } else {
                        // 子要素がStory以下のタイプを含むかチェック
                        const childItems = item.querySelectorAll('.tree-item:not(.search-hidden)');
                        let hasStoryOrLeaf = false;
                        childItems.forEach(child => {
                            const childTypeBadge = child.querySelector(':scope > .tree-item-header .type-badge');
                            const childType = childTypeBadge?.textContent?.trim().toLowerCase() || '';
                            if (childType === 'story' || childType === 'task' || childType === 'bug' || childType === 'test') {
                                hasStoryOrLeaf = true;
                            }
                        });
                        if (!hasStoryOrLeaf) {
                            item.classList.add('search-hidden');
                        }
                    }
                }
            });
        }

        function clearAllFilters() {
            document.getElementById('searchInput').value = '';
            document.getElementById('versionFilter').value = '';
            document.getElementById('assigneeFilter').value = '';
            document.getElementById('trackerFilter').value = '';

            // ステータスチェックボックスをデフォルト状態にリセット（未着手と着手中をチェック）
            resetStatusFilterToDefault();

            // 空の階層を非表示チェックボックスをリセット（デフォルトOFF）
            const hideEmptyCheckbox = document.getElementById('hideEmptyHierarchy');
            if (hideEmptyCheckbox) hideEmptyCheckbox.checked = false;

            // Reset all items
            const items = document.querySelectorAll('.tree-item');
            items.forEach(item => {
                item.classList.remove('search-hidden', 'search-match');
            });

            // Reapply server-side filters
            applyFilters();
        }

        function resetStatusFilterToDefault() {
            const statusCheckboxes = document.querySelectorAll('input[name="statusFilter"]');
            statusCheckboxes.forEach(cb => {
                cb.checked = (cb.value === '未着手' || cb.value === '着手中');
            });
            // Update dropdown text
            const textEl = document.querySelector('.multiselect-text');
            if (textEl) {
                textEl.textContent = '未着手, 着手中';
            }
        }

        function clearFilter(filterType) {
            switch(filterType) {
                case 'search':
                    document.getElementById('searchInput').value = '';
                    applyClientFilters();
                    break;
                case 'version':
                    document.getElementById('versionFilter').value = '';
                    applyFilters();
                    break;
                case 'status':
                    resetStatusFilterToDefault();
                    applyClientFilters();
                    break;
                case 'assignee':
                    document.getElementById('assigneeFilter').value = '';
                    applyClientFilters();
                    break;
                case 'tracker':
                    document.getElementById('trackerFilter').value = '';
                    applyClientFilters();
                    break;
                case 'hideEmpty':
                    const hideEmptyCheckbox = document.getElementById('hideEmptyHierarchy');
                    if (hideEmptyCheckbox) hideEmptyCheckbox.checked = false;
                    applyClientFilters();
                    break;
            }
        }

        function filterBySearch(searchText) {
            applyClientFilters();
        }

        // Expand all button
        function expandAll() {
            document.querySelectorAll('.tree-item').forEach(item => {
                item.classList.remove('collapsed');
            });
        }

        // Collapse all button
        function collapseAll() {
            document.querySelectorAll('.tree-item').forEach(item => {
                item.classList.add('collapsed');
            });
        }

        // ========================================
        // Issue Detail (Modal Display)
        // ========================================
        const detailCache = {};
        const issueHistoryStack = []; // 履歴スタック for 戻るボタン

        function toggleDetail(event, issueId) {
            event.stopPropagation();
            openDetailModal(issueId);
        }

        function openDetailModal(issueId, addToHistory = true) {
            // 履歴スタックに追加（戻るボタン用）
            if (addToHistory && currentModalIssueId && currentModalIssueId !== issueId) {
                issueHistoryStack.push(currentModalIssueId);
            }

            currentModalIssueId = issueId;
            const modal = document.getElementById('commentsModal');

            if (!modal) return;

            // Show modal with loading state
            modal.classList.add('open');

            // Check cache first
            if (detailCache[issueId]) {
                try {
                    renderDetailModal(detailCache[issueId]);
                } catch (e) {
                    console.error('Failed to render cached detail modal:', e);
                    const bodyEl = document.getElementById('modalCommentsList');
                    if (bodyEl) {
                        bodyEl.innerHTML = '<div class="detail-error">Error rendering detail: ' + escapeHtml(e.message || 'Unknown error') + '</div>';
                    }
                }
            } else {
                // Show loading state
                const bodyEl = document.getElementById('modalCommentsList');
                if (bodyEl) {
                    bodyEl.innerHTML = '<div class="detail-loading">Loading...</div>';
                }
                // Request detail from extension
                vscode.postMessage({ command: 'getIssueDetail', issueId: issueId });
            }

            // Add keyboard listener for Escape
            document.addEventListener('keydown', handleModalKeydown);
        }

        // 別のチケットに移動（モーダル内ナビゲーション）
        function navigateToIssue(issueId) {
            openDetailModal(issueId, true);
        }

        // 戻るボタン（履歴スタックから前のチケットに戻る）
        function goBackInHistory() {
            if (issueHistoryStack.length > 0) {
                const previousIssueId = issueHistoryStack.pop();
                openDetailModal(previousIssueId, false);
            }
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            if (message.command === 'issueDetail') {
                // Cache the result
                detailCache[message.issueId] = message.detail;
                // Update modal if open
                if (currentModalIssueId === message.issueId) {
                    try {
                        renderDetailModal(message.detail);
                    } catch (e) {
                        console.error('Failed to render detail modal:', e);
                        const bodyEl = document.getElementById('modalCommentsList');
                        if (bodyEl) {
                            bodyEl.innerHTML = '<div class="detail-error">Error rendering detail: ' + escapeHtml(e.message || 'Unknown error') + '</div>';
                        }
                    }
                }
            } else if (message.command === 'issueDetailError') {
                if (currentModalIssueId === message.issueId) {
                    const bodyEl = document.getElementById('modalCommentsList');
                    if (bodyEl) {
                        bodyEl.innerHTML = '<div class="detail-error">Error: ' + escapeHtml(message.error) + '</div>';
                    }
                }
            } else if (message.command === 'commentSuccess') {
                onModalCommentSuccess();
            } else if (message.command === 'commentError') {
                onModalCommentError(message.error);
            } else if (message.command === 'statusUpdateSuccess') {
                onStatusUpdateSuccess(message.issueId, message.newStatus);
            } else if (message.command === 'statusUpdateError') {
                onStatusUpdateError(message.issueId, message.error);
            } else if (message.command === 'assigneeUpdateSuccess') {
                onAssigneeUpdateSuccess(message.issueId, message.newAssignee, message.newAssigneeId);
            } else if (message.command === 'assigneeUpdateError') {
                onAssigneeUpdateError(message.issueId, message.error);
            } else if (message.command === 'copyIssueUrlReady') {
                copyToClipboard(message.url, message.issueId);
            }
        });

        function onStatusUpdateSuccess(issueId, newStatus) {
            const dropdown = document.querySelector('.status-dropdown[data-issue-id="' + issueId + '"]');
            const badge = dropdown?.querySelector('.status-badge');

            if (badge) {
                badge.classList.remove('status-updating');

                // Update badge text (keep the arrow)
                const arrow = badge.querySelector('.status-dropdown-arrow');
                badge.innerHTML = escapeHtml(newStatus) + (arrow ? arrow.outerHTML : '<span class="status-dropdown-arrow">▼</span>');

                // Update status class
                badge.className = 'status-badge status-clickable ' + getStatusClassFromName(newStatus);
            }

            // Update modal select if open
            const modalStatusSelect = document.getElementById('modalStatusSelect');
            if (modalStatusSelect && currentModalIssueId === issueId) {
                modalStatusSelect.disabled = false;
                modalStatusSelect.classList.remove('modal-select-updating');
                modalStatusSelect.value = newStatus;
            }

            // Clear detail cache for this issue
            delete detailCache[issueId];
        }

        function onStatusUpdateError(issueId, errorMessage) {
            const dropdown = document.querySelector('.status-dropdown[data-issue-id="' + issueId + '"]');
            const badge = dropdown?.querySelector('.status-badge');

            if (badge) {
                badge.classList.remove('status-updating');
            }

            // Update modal select if open
            const modalStatusSelect = document.getElementById('modalStatusSelect');
            if (modalStatusSelect && currentModalIssueId === issueId) {
                modalStatusSelect.disabled = false;
                modalStatusSelect.classList.remove('modal-select-updating');
            }

            // Show error notification
            alert('Failed to update status: ' + errorMessage);
        }

        function onAssigneeUpdateSuccess(issueId, newAssignee, newAssigneeId) {
            const dropdown = document.querySelector('.assignee-dropdown[data-issue-id="' + issueId + '"]');
            const badge = dropdown?.querySelector('.assignee-badge');

            if (badge) {
                badge.classList.remove('assignee-updating');

                // Update badge text (keep the arrow)
                const displayName = newAssignee || 'Unassigned';
                const arrow = badge.querySelector('.assignee-dropdown-arrow');
                badge.innerHTML = '@' + escapeHtml(displayName) + (arrow ? arrow.outerHTML : '<span class="assignee-dropdown-arrow">▼</span>');
            }

            // Update dropdown data attribute
            if (dropdown) {
                dropdown.setAttribute('data-current-assignee-id', newAssigneeId || '');
            }

            // Update modal select if open
            const modalAssigneeSelect = document.getElementById('modalAssigneeSelect');
            if (modalAssigneeSelect && currentModalIssueId === issueId) {
                modalAssigneeSelect.disabled = false;
                modalAssigneeSelect.classList.remove('modal-select-updating');
                modalAssigneeSelect.value = newAssigneeId || '';
            }

            // Clear detail cache for this issue
            delete detailCache[issueId];
        }

        function onAssigneeUpdateError(issueId, errorMessage) {
            const dropdown = document.querySelector('.assignee-dropdown[data-issue-id="' + issueId + '"]');
            const badge = dropdown?.querySelector('.assignee-badge');

            if (badge) {
                badge.classList.remove('assignee-updating');
            }

            // Update modal select if open
            const modalAssigneeSelect = document.getElementById('modalAssigneeSelect');
            if (modalAssigneeSelect && currentModalIssueId === issueId) {
                modalAssigneeSelect.disabled = false;
                modalAssigneeSelect.classList.remove('modal-select-updating');
            }

            // Show error notification
            alert('Failed to update assignee: ' + errorMessage);
        }

        function getStatusClassFromName(statusName) {
            if (!statusName) return 'status-open';
            const name = statusName.toLowerCase();
            if (name.includes('close') || name.includes('クローズ') || name.includes('完了')) {
                return 'status-closed';
            }
            if (name.includes('progress') || name.includes('着手') || name.includes('進行')) {
                return 'status-in-progress';
            }
            if (name.includes('review') || name.includes('レビュー')) {
                return 'status-review';
            }
            if (name.includes('block') || name.includes('保留')) {
                return 'status-blocked';
            }
            return 'status-open';
        }

        function renderDetailModal(detail) {
            if (!detail || !detail.issue) {
                throw new Error('Invalid detail data');
            }
            const issue = detail.issue;
            const journals = detail.journals || [];
            const children = detail.children || [];
            const assignee = issue.assigned_to ? issue.assigned_to.name : 'Unassigned';
            const assigneeId = issue.assigned_to ? String(issue.assigned_to.id) : '';
            const version = issue.fixed_version ? issue.fixed_version.name : 'None';
            const doneRatio = issue.done_ratio || 0;
            const currentStatus = issue.status ? issue.status.name : 'Unknown';
            const parent = issue.parent;
            const tracker = issue.tracker ? issue.tracker.name : '';
            const issueUrl = issue.url || '';
            const issueId = String(issue.id);

            // Update modal title with back button
            const titleEl = document.querySelector('.modal-title');
            if (titleEl) {
                const backBtn = issueHistoryStack.length > 0
                    ? '<button class="modal-back-btn" onclick="goBackInHistory()" title="Go back">←</button>'
                    : '';
                titleEl.innerHTML = backBtn +
                    '<span class="modal-tracker-badge">' + escapeHtml(tracker) + '</span>' +
                    '<span class="modal-issue-id" onclick="openInBrowser(\\'' + escapeHtml(issueUrl) + '\\')" title="Open in browser">#' + issueId + '</span>' +
                    '<span class="modal-copy-btn" onclick="copyModalIssueUrl(\\'' + escapeHtml(issueUrl) + '\\', \\'' + issueId + '\\')" title="Copy URL">Copy</span> ' +
                    '<span class="modal-subject">' + escapeHtml(issue.subject || '') + '</span>';
            }

            // Build status dropdown options
            const statusOptions = (typeof globalStatuses !== 'undefined' ? globalStatuses : []).map(function(s) {
                const selected = s === currentStatus ? ' selected' : '';
                return '<option value="' + escapeHtml(s) + '"' + selected + '>' + escapeHtml(s) + '</option>';
            }).join('');

            // Build assignee dropdown options
            const memberOptions = (typeof globalMembers !== 'undefined' ? globalMembers : []).map(function(m) {
                const selected = m.id === assigneeId ? ' selected' : '';
                return '<option value="' + escapeHtml(m.id) + '"' + selected + '>' + escapeHtml(m.name) + '</option>';
            }).join('');

            // Build unified hierarchy section (parent → current → children)
            const hasHierarchy = (parent && parent.id) || children.length > 0;
            const hierarchyHtml = hasHierarchy
                ? '<div class="modal-hierarchy">' +
                      '<div class="modal-section-label">Hierarchy</div>' +
                      '<div class="hierarchy-tree">' +
                          // Parent (if exists)
                          (parent && parent.id
                              ? '<div class="hierarchy-item hierarchy-parent" onclick="navigateToIssue(\\'' + String(parent.id) + '\\')">' +
                                    '<span class="hierarchy-indent"></span>' +
                                    '<span class="hierarchy-icon">↑</span>' +
                                    '<span class="hierarchy-id">#' + String(parent.id) + '</span>' +
                                    '<span class="hierarchy-subject">' + escapeHtml(parent.subject || '') + '</span>' +
                                '</div>'
                              : '') +
                          // Current issue (always shown in hierarchy)
                          '<div class="hierarchy-item hierarchy-current">' +
                              '<span class="hierarchy-indent">' + (parent && parent.id ? '└' : '') + '</span>' +
                              '<span class="hierarchy-icon">●</span>' +
                              '<span class="hierarchy-id">#' + issueId + '</span>' +
                              '<span class="hierarchy-subject">' + escapeHtml(issue.subject || '') + '</span>' +
                          '</div>' +
                          // Children (if exist)
                          children.map(function(child, index) {
                              if (!child) return '';
                              const childId = String(child.id);
                              const childStatus = child.status ? child.status.name : 'Unknown';
                              const statusClass = getStatusClassFromName(childStatus);
                              const isLast = index === children.length - 1;
                              return '<div class="hierarchy-item hierarchy-child" onclick="navigateToIssue(\\'' + childId + '\\')">' +
                                  '<span class="hierarchy-indent">' + (isLast ? '└' : '├') + '</span>' +
                                  '<span class="hierarchy-icon">→</span>' +
                                  '<span class="hierarchy-id">#' + childId + '</span>' +
                                  '<span class="hierarchy-status ' + statusClass + '">' + escapeHtml(childStatus) + '</span>' +
                                  '<span class="hierarchy-subject">' + escapeHtml(child.subject || '') + '</span>' +
                              '</div>';
                          }).join('') +
                      '</div>' +
                  '</div>'
                : '';

            // Update modal body
            const bodyEl = document.getElementById('modalCommentsList');
            if (bodyEl) {
                bodyEl.innerHTML =
                    '<div class="modal-detail-header">' +
                        '<div class="modal-detail-row">' +
                            '<div class="modal-detail-item">' +
                                '<span class="modal-detail-label">Status:</span>' +
                                '<select class="modal-select modal-status-select" id="modalStatusSelect" onchange="onModalStatusChange(this)">' +
                                    statusOptions +
                                '</select>' +
                            '</div>' +
                            '<div class="modal-detail-item">' +
                                '<span class="modal-detail-label">Assignee:</span>' +
                                '<select class="modal-select modal-assignee-select" id="modalAssigneeSelect" onchange="onModalAssigneeChange(this)">' +
                                    '<option value="">Unassigned</option>' +
                                    memberOptions +
                                '</select>' +
                            '</div>' +
                            '<div class="modal-detail-item">' +
                                '<span class="modal-detail-label">Version:</span>' +
                                '<span class="modal-detail-value">' + escapeHtml(version) + '</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="modal-detail-progress">' +
                            '<span class="modal-detail-label">Progress:</span>' +
                            '<div class="progress-bar">' +
                                '<div class="progress-bar-fill" style="width: ' + doneRatio + '%"></div>' +
                            '</div>' +
                            '<span class="progress-text">' + doneRatio + '%</span>' +
                        '</div>' +
                    '</div>' +
                    hierarchyHtml +
                    '<div class="modal-description">' +
                        '<div class="modal-section-label">Description</div>' +
                        '<div class="modal-description-content">' + (issue.descriptionHtml || renderMarkdown(issue.description || '')) + '</div>' +
                    '</div>' +
                    '<div class="modal-comments">' +
                        '<div class="modal-section-label">' +
                            'Comments & History ' +
                            '<span class="comments-count">' + journals.length + '</span>' +
                        '</div>' +
                        '<div class="modal-comments-container">' +
                            renderModalJournals(journals) +
                        '</div>' +
                    '</div>' +
                    '<div class="modal-actions">' +
                        '<button class="btn" onclick="openInBrowser(\\'' + escapeHtml(issueUrl) + '\\')">Open in Browser</button>' +
                    '</div>';
            }
        }

        function onModalStatusChange(selectEl) {
            if (!currentModalIssueId) return;
            const newStatus = selectEl.value;

            // Show loading state
            selectEl.disabled = true;
            selectEl.classList.add('modal-select-updating');

            vscode.postMessage({
                command: 'updateStatus',
                issueId: currentModalIssueId,
                statusName: newStatus
            });
        }

        function onModalAssigneeChange(selectEl) {
            if (!currentModalIssueId) return;
            const newAssigneeId = selectEl.value;
            const newAssigneeName = selectEl.options[selectEl.selectedIndex].text;

            // Show loading state
            selectEl.disabled = true;
            selectEl.classList.add('modal-select-updating');

            vscode.postMessage({
                command: 'updateAssignee',
                issueId: currentModalIssueId,
                assigneeId: newAssigneeId,
                assigneeName: newAssigneeName
            });
        }

        function renderChangeDetail(detail) {
            const fieldName = getFieldDisplayName(detail.name);
            const oldVal = detail.old_value || '(none)';
            const newVal = detail.new_value || '(none)';

            return '<div class="change-item">' +
                '<span class="change-label">' + escapeHtml(fieldName) + ':</span>' +
                '<span class="change-old">' + escapeHtml(oldVal) + '</span>' +
                '<span class="change-arrow">→</span>' +
                '<span class="change-new">' + escapeHtml(newVal) + '</span>' +
            '</div>';
        }

        function getFieldDisplayName(fieldName) {
            const fieldMap = {
                'status_id': 'Status',
                'assigned_to_id': 'Assignee',
                'fixed_version_id': 'Version',
                'done_ratio': 'Progress',
                'priority_id': 'Priority',
                'tracker_id': 'Tracker',
                'subject': 'Subject',
                'description': 'Description',
                'start_date': 'Start Date',
                'due_date': 'Due Date',
                'parent_id': 'Parent',
                'estimated_hours': 'Estimated Hours'
            };
            return fieldMap[fieldName] || fieldName;
        }

        function formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
        }

        function openInBrowser(url) {
            vscode.postMessage({ command: 'openInBrowser', url: url });
        }

        // ========================================
        // Detail Modal
        // ========================================
        let currentModalIssueId = null;

        function closeCommentsModal() {
            const modal = document.getElementById('commentsModal');
            if (modal) {
                modal.classList.remove('open');
            }
            currentModalIssueId = null;
            // 履歴スタックをクリア
            issueHistoryStack.length = 0;
            document.removeEventListener('keydown', handleModalKeydown);
        }

        function handleModalKeydown(e) {
            if (e.key === 'Escape') {
                closeCommentsModal();
            }
        }

        function renderModalJournals(journals) {
            if (!journals || journals.length === 0) {
                return '<div class="no-modal-comments">No comments or changes yet</div>';
            }

            return journals.map(function(journal) {
                const hasNotes = journal.notes && journal.notes.trim().length > 0;
                const hasChanges = journal.details && journal.details.length > 0;

                if (!hasNotes && !hasChanges) {
                    return '';
                }

                const date = formatDate(journal.created_on);
                const author = journal.user ? journal.user.name : 'Unknown';

                let html = '<div class="modal-comment-item">';
                html += '<div class="modal-comment-header">';
                html += '<span class="modal-comment-author">' + escapeHtml(author) + '</span>';
                html += '<span class="modal-comment-date">' + escapeHtml(date) + '</span>';
                html += '</div>';

                if (hasNotes) {
                    html += '<div class="modal-comment-body">' + (journal.notesHtml || renderMarkdown(journal.notes)) + '</div>';
                }

                if (hasChanges) {
                    html += '<div class="modal-comment-changes">';
                    journal.details.forEach(function(detail) {
                        html += renderChangeDetail(detail);
                    });
                    html += '</div>';
                }

                html += '</div>';
                return html;
            }).join('');
        }

        function submitModalComment() {
            const textarea = document.getElementById('modalCommentInput');
            const btn = document.getElementById('modalCommentBtn');
            const successMsg = document.getElementById('modalCommentSuccess');
            const errorMsg = document.getElementById('modalCommentError');

            if (!textarea || !btn || !currentModalIssueId) return;

            const comment = textarea.value.trim();
            if (!comment) {
                errorMsg.textContent = 'Please enter a comment';
                errorMsg.classList.add('show');
                setTimeout(() => errorMsg.classList.remove('show'), 3000);
                return;
            }

            // Reset messages
            successMsg.classList.remove('show');
            errorMsg.classList.remove('show');

            // Set loading state
            btn.disabled = true;
            btn.classList.add('loading');
            btn.textContent = '';

            vscode.postMessage({
                command: 'addComment',
                issueId: currentModalIssueId,
                comment: comment,
                fromModal: true
            });
        }

        function onModalCommentSuccess() {
            const textarea = document.getElementById('modalCommentInput');
            const btn = document.getElementById('modalCommentBtn');
            const successMsg = document.getElementById('modalCommentSuccess');
            const errorMsg = document.getElementById('modalCommentError');

            if (btn) {
                btn.disabled = false;
                btn.classList.remove('loading');
                btn.textContent = 'Add Comment';
            }

            if (textarea) {
                textarea.value = '';
            }

            if (successMsg) {
                successMsg.classList.add('show');
                setTimeout(() => successMsg.classList.remove('show'), 3000);
            }

            if (errorMsg) {
                errorMsg.classList.remove('show');
            }

            // Refresh modal content
            if (currentModalIssueId) {
                delete detailCache[currentModalIssueId];
                vscode.postMessage({ command: 'getIssueDetail', issueId: currentModalIssueId });
            }
        }

        function onModalCommentError(errorMessage) {
            const btn = document.getElementById('modalCommentBtn');
            const errorMsg = document.getElementById('modalCommentError');

            if (btn) {
                btn.disabled = false;
                btn.classList.remove('loading');
                btn.textContent = 'Add Comment';
            }

            if (errorMsg) {
                errorMsg.textContent = errorMessage || 'Failed to add comment';
                errorMsg.classList.add('show');
            }
        }

        // ========================================
        // Simple Markdown Renderer
        // ========================================
        function renderMarkdown(text) {
            if (!text) return '';

            let html = escapeHtml(text);

            // Code blocks (must come before inline code)
            html = html.replace(/\\\`\\\`\\\`([\\s\\S]*?)\\\`\\\`\\\`/g, '<pre><code>$1</code></pre>');

            // Inline code
            html = html.replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>');

            // Headers
            html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
            html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
            html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

            // Bold
            html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');

            // Italic
            html = html.replace(/\\*(.+?)\\*/g, '<em>$1</em>');

            // Links
            html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank">$1</a>');

            // Blockquotes
            html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

            // Horizontal rule
            html = html.replace(/^---$/gm, '<hr>');

            // Unordered lists
            html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
            html = html.replace(/(<li>.*<\\/li>\\n?)+/g, '<ul>$&</ul>');

            // Line breaks (preserve paragraphs)
            html = html.replace(/\\n\\n/g, '</p><p>');
            html = html.replace(/\\n/g, '<br>');

            // Wrap in paragraph if not already wrapped
            if (!html.startsWith('<')) {
                html = '<p>' + html + '</p>';
            }

            return html;
        }

        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    `;
}
