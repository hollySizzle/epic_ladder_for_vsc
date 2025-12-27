/**
 * CSS styles for the Epic Ladder webview
 */
export function getStyles(): string {
    return `
        :root {
            --bg-color: var(--vscode-editor-background);
            --text-color: var(--vscode-editor-foreground);
            --border-color: var(--vscode-panel-border);
            --hover-bg: var(--vscode-list-hoverBackground);
            --focus-bg: var(--vscode-list-activeSelectionBackground);
            --input-bg: var(--vscode-input-background);
            --input-border: var(--vscode-input-border);
            --button-bg: var(--vscode-button-background);
            --button-fg: var(--vscode-button-foreground);
            --indent-size: 24px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        html, body {
            height: 100%;
            margin: 0;
            overflow: hidden;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--text-color);
            background: var(--bg-color);
            line-height: 1.5;
        }

        .container {
            max-width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            container-type: inline-size;
        }

        .fixed-header {
            flex-shrink: 0;
            padding: 12px 12px 0 12px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
        }

        .header h1 {
            font-size: 1.2em;
            font-weight: 600;
        }

        .header-actions {
            display: flex;
            gap: 4px;
        }

        .btn {
            background: var(--button-bg);
            color: var(--button-fg);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }

        .btn:hover {
            opacity: 0.9;
        }

        .btn-icon {
            padding: 4px 8px;
            font-size: 16px;
        }

        /* Filter toggle button (narrow width) */
        .filter-toggle {
            display: none;
            align-items: center;
            gap: 6px;
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--border-color);
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            color: var(--text-color);
            font-size: 13px;
            margin-bottom: 8px;
            width: 100%;
        }

        .filter-toggle .hamburger {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .filter-toggle .hamburger span {
            display: block;
            width: 16px;
            height: 2px;
            background: var(--text-color);
            border-radius: 1px;
        }

        .filter-badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 10px;
            margin-left: auto;
        }

        .filters {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 12px;
            padding: 12px;
            background: var(--vscode-sideBar-background);
            border-radius: 6px;
        }

        .filters.collapsed {
            display: none;
        }

        .filter-row {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }

        .filter-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
            min-width: 120px;
        }

        .filter-actions {
            flex: 0 0 auto;
            min-width: auto;
        }

        .btn-clear {
            background: transparent;
            color: var(--vscode-textLink-foreground);
            border: 1px solid var(--border-color);
            font-size: 12px;
            padding: 5px 10px;
        }

        .btn-clear:hover {
            background: var(--hover-bg);
        }

        .active-filters {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            align-items: center;
            padding-top: 8px;
            border-top: 1px solid var(--border-color);
        }

        .active-filters-label {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }

        .active-filter-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
        }

        .remove-filter {
            cursor: pointer;
            opacity: 0.7;
            font-weight: bold;
            padding: 0 2px;
        }

        .remove-filter:hover {
            opacity: 1;
        }

        .filter-group label {
            font-size: 10px;
            text-transform: uppercase;
            opacity: 0.8;
        }

        .filter-group input[type="text"],
        .filter-group select {
            background: var(--input-bg);
            color: var(--text-color);
            border: 1px solid var(--input-border);
            padding: 6px 8px;
            border-radius: 4px;
            font-size: 13px;
            width: 100%;
        }

        .filter-group input[type="text"]:focus,
        .filter-group select:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        /* Multiselect Dropdown */
        .filter-group-status {
            min-width: 140px;
        }

        .multiselect-dropdown {
            position: relative;
        }

        .multiselect-toggle {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            background: var(--input-bg);
            color: var(--text-color);
            border: 1px solid var(--input-border);
            padding: 6px 8px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            text-align: left;
        }

        .multiselect-toggle:hover {
            background: var(--hover-bg);
        }

        .multiselect-toggle:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .multiselect-text {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .multiselect-arrow {
            font-size: 8px;
            margin-left: 6px;
            opacity: 0.7;
        }

        .multiselect-menu {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            z-index: 1000;
            background: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            margin-top: 2px;
            max-height: 200px;
            overflow-y: auto;
        }

        .multiselect-menu.open {
            display: block;
        }

        .multiselect-option {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.1s;
        }

        .multiselect-option:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .multiselect-option input[type="checkbox"] {
            width: 14px;
            height: 14px;
            margin: 0;
            cursor: pointer;
            accent-color: var(--vscode-button-background);
        }

        .multiselect-option span {
            flex: 1;
        }

        /* Inline Checkbox (空の階層を非表示) */
        .filter-checkbox {
            flex: 0 0 auto;
            min-width: auto;
            display: flex;
            align-items: flex-end;
        }

        .inline-checkbox {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            font-size: 12px;
            padding: 6px 0;
            white-space: nowrap;
        }

        .inline-checkbox input[type="checkbox"] {
            width: 14px;
            height: 14px;
            margin: 0;
            cursor: pointer;
            accent-color: var(--vscode-button-background);
        }

        .inline-checkbox span {
            opacity: 0.9;
        }

        .summary {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 12px;
            padding: 8px;
            background: var(--vscode-sideBar-background);
            border-radius: 6px;
            flex-shrink: 0;
        }

        .scrollable-content {
            flex: 1;
            overflow-y: auto;
            padding: 0 12px 12px 12px;
            min-height: 0;
        }

        .summary-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
        }

        .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
        }

        .badge-epic { background: #f59e0b; color: #000; }
        .badge-feature { background: #f97316; color: #000; }
        .badge-story { background: #3b82f6; color: #fff; }
        .badge-task { background: #22c55e; color: #000; }
        .badge-bug { background: #ef4444; color: #fff; }
        .badge-test { background: #a855f7; color: #fff; }

        .tree-container {
            border: 1px solid var(--border-color);
            border-radius: 6px;
            overflow: hidden;
        }

        .tree-item {
            border-bottom: 1px solid var(--border-color);
        }

        .tree-item:last-child {
            border-bottom: none;
        }

        .tree-item-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 10px;
            cursor: pointer;
            transition: background 0.15s;
        }

        .tree-item-header:hover {
            background: var(--hover-bg);
        }

        .tree-item-header.no-children {
            cursor: default;
        }

        .collapse-icon {
            font-size: 10px;
            transition: transform 0.2s;
            width: 12px;
            flex-shrink: 0;
            text-align: center;
        }

        .collapse-icon-placeholder {
            width: 12px;
            flex-shrink: 0;
        }

        .tree-item.collapsed .collapse-icon {
            transform: rotate(-90deg);
        }

        .tree-item.collapsed > .tree-children {
            display: none;
        }

        .tree-children {
            padding-left: var(--indent-size);
            border-top: 1px solid var(--border-color);
            position: relative;
        }

        /* Indent guide (vertical line) for tree hierarchy */
        .tree-children::before {
            content: '';
            position: absolute;
            left: 10px;
            top: 0;
            bottom: 0;
            width: 1px;
            background: var(--vscode-tree-indentGuidesStroke, var(--border-color));
            opacity: 0.5;
        }

        .type-badge {
            font-size: 9px;
            padding: 1px 5px;
            border-radius: 4px;
            font-weight: 500;
            flex-shrink: 0;
        }

        .status-badge {
            font-size: 9px;
            padding: 1px 5px;
            border-radius: 4px;
            flex-shrink: 0;
        }

        .status-open { background: var(--vscode-statusBarItem-warningBackground); color: var(--vscode-statusBarItem-warningForeground); }
        .status-in-progress { background: #3b82f6; color: #fff; }
        .status-review { background: #a855f7; color: #fff; }
        .status-blocked { background: #f97316; color: #000; }
        .status-closed { background: #22c55e; color: #000; }

        /* Status Dropdown Styles */
        .status-dropdown {
            position: relative;
            display: inline-block;
            flex-shrink: 0;
        }

        .status-clickable {
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 3px;
            transition: opacity 0.15s;
        }

        .status-clickable:hover {
            opacity: 0.85;
        }

        .status-dropdown-arrow {
            font-size: 6px;
            opacity: 0.7;
        }

        .status-dropdown-menu {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            z-index: 1000;
            min-width: 100px;
            background: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            margin-top: 2px;
        }

        .status-dropdown-menu.open {
            display: block;
        }

        .status-option {
            padding: 6px 10px;
            font-size: 11px;
            cursor: pointer;
            white-space: nowrap;
        }

        .status-option:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .status-option:first-child {
            border-radius: 4px 4px 0 0;
        }

        .status-option:last-child {
            border-radius: 0 0 4px 4px;
        }

        .status-updating {
            opacity: 0.6;
            pointer-events: none;
        }

        .status-updating::after {
            content: '';
            display: inline-block;
            width: 8px;
            height: 8px;
            margin-left: 4px;
            border: 1px solid currentColor;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }

        /* Assignee Dropdown Styles */
        .assignee-dropdown {
            position: relative;
            display: inline-block;
            flex-shrink: 0;
        }

        .assignee-badge {
            font-size: 10px;
            padding: 1px 5px;
            border-radius: 4px;
            flex-shrink: 0;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .assignee-clickable {
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 3px;
            transition: opacity 0.15s;
        }

        .assignee-clickable:hover {
            opacity: 0.85;
        }

        .assignee-dropdown-arrow {
            font-size: 6px;
            opacity: 0.7;
        }

        .assignee-dropdown-menu {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            z-index: 1000;
            min-width: 150px;
            max-width: 200px;
            background: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            margin-top: 2px;
        }

        .assignee-dropdown-menu.open {
            display: block;
        }

        .assignee-search-container {
            padding: 6px;
            border-bottom: 1px solid var(--border-color);
        }

        .assignee-search-input {
            width: 100%;
            padding: 4px 8px;
            background: var(--input-bg);
            color: var(--text-color);
            border: 1px solid var(--input-border);
            border-radius: 3px;
            font-size: 11px;
        }

        .assignee-search-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .assignee-options-container {
            max-height: 180px;
            overflow-y: auto;
        }

        .assignee-option {
            padding: 6px 10px;
            font-size: 11px;
            cursor: pointer;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .assignee-option:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .assignee-updating {
            opacity: 0.6;
            pointer-events: none;
        }

        .assignee-updating::after {
            content: '';
            display: inline-block;
            width: 8px;
            height: 8px;
            margin-left: 4px;
            border: 1px solid currentColor;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }

        .issue-id {
            font-family: monospace;
            font-size: 13px;
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            flex-shrink: 0;
            font-weight: 600;
        }

        .issue-id:hover {
            text-decoration: underline;
        }

        /* Copy URL Button */
        .copy-url-btn {
            cursor: pointer;
            font-size: 10px;
            padding: 1px 6px;
            background: rgba(255, 255, 255, 0.1);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            transition: all 0.15s;
            flex-shrink: 0;
        }

        .copy-url-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.3);
        }

        .copy-url-btn.copied {
            background: #22c55e;
            color: #000;
            border-color: #22c55e;
        }

        .issue-subject {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
        }

        .meta-info {
            display: flex;
            gap: 6px;
            flex-shrink: 0;
        }

        .version {
            font-size: 10px;
            opacity: 0.8;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 1px 5px;
            border-radius: 4px;
            max-width: 80px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .empty-state {
            padding: 32px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
        }

        .tree-item.search-hidden {
            display: none;
        }

        .tree-item.search-match .issue-subject {
            background: var(--vscode-editor-findMatchHighlightBackground);
        }

        /* ========================================
           Narrow Width Optimization (< 500px)
           ======================================== */
        @container (max-width: 500px) {
            :root {
                --indent-size: 10px;
            }

            .fixed-header {
                padding: 8px 8px 0 8px;
            }

            .scrollable-content {
                padding: 0 8px 8px 8px;
            }

            .header {
                margin-bottom: 8px;
            }

            .header h1 {
                font-size: 1em;
            }

            /* Show filter toggle button */
            .filter-toggle {
                display: flex;
            }

            /* Filters become collapsible */
            .filters {
                gap: 8px;
                padding: 10px;
                margin-bottom: 8px;
            }

            .filter-row {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .filter-group {
                flex: 1 1 45%;
                min-width: 100px;
            }

            /* 全幅にする要素 */
            .filter-group-search,
            .filter-group-status {
                flex: 1 1 100%;
            }

            .filter-actions {
                flex: 1 1 100%;
            }

            .btn-clear {
                width: 100%;
            }

            .active-filters {
                flex-direction: row;
                padding-top: 6px;
            }

            .active-filter-badge {
                font-size: 10px;
                padding: 2px 6px;
            }

            /* Multiselect dropdown for narrow screens */
            .multiselect-toggle {
                padding: 5px 6px;
                font-size: 12px;
            }

            .multiselect-option {
                padding: 6px 8px;
                font-size: 11px;
            }

            /* Summary wraps into 2 rows */
            .summary {
                gap: 6px;
                padding: 6px 8px;
                margin-bottom: 8px;
            }

            .summary-item {
                font-size: 10px;
            }

            .badge {
                padding: 1px 4px;
                font-size: 9px;
            }

            /* Tree item: multi-line layout */
            .tree-item-header {
                flex-wrap: wrap;
                padding: 8px;
                gap: 4px;
            }

            /* Row 1: Type badge + Subject (wrap enabled) */
            .issue-subject {
                order: 1;
                flex-basis: calc(100% - 40px);
                white-space: normal;
                word-break: break-word;
                line-height: 1.3;
            }

            .collapse-icon,
            .collapse-icon-placeholder {
                order: 0;
            }

            .type-badge {
                order: 2;
            }

            /* Row 2: ID, Copy button, Status, Assignee, Version */
            .issue-id {
                order: 3;
                font-size: 12px;
            }

            .copy-url-btn {
                order: 4;
            }

            .status-dropdown {
                order: 5;
            }

            .assignee-dropdown {
                order: 6;
            }

            .meta-info {
                order: 7;
                flex-basis: 100%;
                margin-top: 2px;
            }

            .assignee,
            .version {
                font-size: 9px;
                max-width: 100px;
            }

            /* Reduce tree indent */
            .tree-children {
                padding-left: 10px;
            }

            /* Adjust indent guide position for narrow width */
            .tree-children::before {
                left: 4px;
            }
        }

        /* Extra narrow (< 350px) */
        @container (max-width: 350px) {
            .header h1 {
                font-size: 0.9em;
            }

            .tree-item-header {
                padding: 6px;
            }

            .type-badge {
                font-size: 8px;
                padding: 1px 4px;
            }

            .status-badge {
                font-size: 8px;
                padding: 1px 4px;
            }

            .issue-id {
                font-size: 11px;
            }

            .tree-children {
                padding-left: 8px;
            }

            /* Adjust indent guide position for extra narrow width */
            .tree-children::before {
                left: 3px;
            }

            .summary-item {
                font-size: 9px;
            }
        }

        /* ========================================
           Issue Detail Panel Styles
           ======================================== */
        .issue-detail-panel {
            background: var(--vscode-sideBar-background);
            border-top: 1px solid var(--border-color);
            padding: 12px;
            display: none;
            animation: slideDown 0.2s ease-out;
        }

        .issue-detail-panel.open {
            display: block;
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                max-height: 0;
            }
            to {
                opacity: 1;
                max-height: 500px;
            }
        }

        .detail-loading {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }

        .detail-loading::before {
            content: '';
            width: 14px;
            height: 14px;
            border: 2px solid var(--vscode-descriptionForeground);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .detail-error {
            color: var(--vscode-errorForeground);
            font-size: 12px;
        }

        .detail-header {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
        }

        .detail-info-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
        }

        .detail-info-label {
            color: var(--vscode-descriptionForeground);
        }

        .detail-info-value {
            color: var(--text-color);
        }

        .detail-progress {
            margin-bottom: 12px;
        }

        .progress-bar {
            height: 6px;
            background: var(--vscode-progressBar-background);
            border-radius: 3px;
            overflow: hidden;
            margin-top: 4px;
        }

        .progress-bar-fill {
            height: 100%;
            background: var(--vscode-progressBar-background);
            background: #22c55e;
            transition: width 0.3s ease;
        }

        .progress-text {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .detail-description {
            font-size: 12px;
            line-height: 1.6;
        }

        .detail-description-label {
            font-size: 10px;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
        }

        .detail-description-content {
            background: var(--vscode-editor-background);
            padding: 10px;
            border-radius: 4px;
            border: 1px solid var(--border-color);
            max-height: 200px;
            overflow-y: auto;
        }

        .detail-description-content:empty::after {
            content: 'No description';
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        /* Markdown rendered styles */
        .detail-description-content h1,
        .detail-description-content h2,
        .detail-description-content h3 {
            margin: 12px 0 6px 0;
            font-weight: 600;
        }

        .detail-description-content h1 { font-size: 1.3em; }
        .detail-description-content h2 { font-size: 1.1em; }
        .detail-description-content h3 { font-size: 1em; }

        .detail-description-content p {
            margin: 6px 0;
        }

        .detail-description-content ul,
        .detail-description-content ol {
            margin: 6px 0;
            padding-left: 20px;
        }

        .detail-description-content li {
            margin: 2px 0;
        }

        .detail-description-content code {
            background: var(--vscode-textCodeBlock-background);
            padding: 1px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
        }

        .detail-description-content pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 8px 0;
        }

        .detail-description-content pre code {
            padding: 0;
            background: none;
        }

        .detail-description-content blockquote {
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            margin: 8px 0;
            padding-left: 12px;
            color: var(--vscode-textBlockQuote-foreground);
        }

        .detail-description-content a {
            color: var(--vscode-textLink-foreground);
        }

        .detail-description-content a:hover {
            text-decoration: underline;
        }

        .detail-description-content hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 12px 0;
        }

        .detail-actions {
            margin-top: 12px;
            display: flex;
            gap: 8px;
        }

        .detail-actions .btn {
            font-size: 11px;
            padding: 4px 10px;
        }

        /* Selected item highlight */
        .tree-item.detail-open > .tree-item-header {
            background: var(--vscode-list-activeSelectionBackground);
        }

        /* ========================================
           Comments Section Styles
           ======================================== */
        .detail-comments {
            margin-top: 12px;
        }

        .detail-comments-label {
            font-size: 10px;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .comments-count {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 1px 6px;
            border-radius: 10px;
            font-size: 10px;
        }

        .comments-list {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--vscode-editor-background);
        }

        .comment-item {
            padding: 10px;
            border-bottom: 1px solid var(--border-color);
        }

        .comment-item:last-child {
            border-bottom: none;
        }

        .comment-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
            flex-wrap: wrap;
        }

        .comment-author {
            font-weight: 600;
            font-size: 12px;
            color: var(--vscode-textLink-foreground);
        }

        .comment-date {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }

        .comment-body {
            font-size: 12px;
            line-height: 1.5;
        }

        .comment-body:empty {
            display: none;
        }

        .comment-body ul,
        .comment-body ol {
            margin: 6px 0;
            padding-left: 24px;
        }

        .comment-body li {
            margin: 2px 0;
        }

        .comment-body p {
            margin: 6px 0;
        }

        .comment-body code {
            background: var(--vscode-textCodeBlock-background);
            padding: 1px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
        }

        .comment-body pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 8px 0;
        }

        .comment-body pre code {
            padding: 0;
            background: none;
        }

        .comment-body blockquote {
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            margin: 8px 0;
            padding-left: 12px;
            color: var(--vscode-textBlockQuote-foreground);
        }

        .comment-body a {
            color: var(--vscode-textLink-foreground);
        }

        .comment-body h1,
        .comment-body h2,
        .comment-body h3 {
            margin: 12px 0 6px 0;
            font-weight: 600;
        }

        .comment-body h1 { font-size: 1.2em; }
        .comment-body h2 { font-size: 1.1em; }
        .comment-body h3 { font-size: 1em; }

        /* Change details (status changes, etc.) */
        .comment-changes {
            margin-top: 6px;
        }

        .change-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            padding: 2px 0;
        }

        .change-label {
            font-weight: 500;
        }

        .change-old {
            text-decoration: line-through;
            opacity: 0.7;
        }

        .change-arrow {
            color: var(--vscode-textLink-foreground);
        }

        .change-new {
            color: var(--text-color);
        }

        .no-comments {
            padding: 16px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            font-style: italic;
        }

        /* ========================================
           Comment Input Form Styles
           ======================================== */
        .comment-input-section {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--border-color);
        }

        .comment-input-label {
            font-size: 10px;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
        }

        .comment-input-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .comment-textarea {
            width: 100%;
            min-height: 80px;
            padding: 8px;
            background: var(--input-bg);
            color: var(--text-color);
            border: 1px solid var(--input-border);
            border-radius: 4px;
            font-family: var(--vscode-font-family);
            font-size: 12px;
            resize: vertical;
        }

        .comment-textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .comment-textarea::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .comment-input-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        }

        .comment-submit-btn {
            background: var(--button-bg);
            color: var(--button-fg);
            border: none;
            padding: 6px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .comment-submit-btn:hover {
            opacity: 0.9;
        }

        .comment-submit-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .comment-submit-btn.loading::before {
            content: '';
            width: 12px;
            height: 12px;
            border: 2px solid var(--button-fg);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        .comment-submit-success {
            color: #22c55e;
            font-size: 11px;
            display: none;
            align-items: center;
            gap: 4px;
        }

        .comment-submit-success.show {
            display: flex;
        }

        .comment-submit-error {
            color: var(--vscode-errorForeground);
            font-size: 11px;
            display: none;
        }

        .comment-submit-error.show {
            display: block;
        }

        @container (max-width: 500px) {
            .issue-detail-panel {
                padding: 10px;
            }

            .detail-header {
                gap: 6px;
            }

            .detail-info-item {
                font-size: 10px;
            }

            .detail-description-content {
                max-height: 150px;
                padding: 8px;
            }

            .comments-list {
                max-height: 200px;
            }

            .comment-item {
                padding: 8px;
            }

            .comment-author {
                font-size: 11px;
            }

            .comment-body {
                font-size: 11px;
            }

            .comment-textarea {
                min-height: 60px;
            }
        }

        /* ========================================
           Modal Styles
           ======================================== */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            padding: 20px;
        }

        .modal-overlay.open {
            display: flex;
        }

        .modal-container {
            background: var(--vscode-editor-background);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            width: 100%;
            max-width: 800px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            flex-shrink: 0;
        }

        .modal-title {
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
            min-width: 0;
            overflow: hidden;
        }

        .modal-issue-id {
            font-family: monospace;
            font-size: 15px;
            font-weight: 700;
            color: var(--vscode-textLink-foreground);
            flex-shrink: 0;
            cursor: pointer;
        }

        .modal-issue-id:hover {
            text-decoration: underline;
        }

        /* Modal Copy URL Button */
        .modal-copy-btn {
            cursor: pointer;
            font-size: 11px;
            padding: 2px 8px;
            background: rgba(255, 255, 255, 0.1);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            transition: all 0.15s;
            flex-shrink: 0;
        }

        .modal-copy-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.3);
        }

        .modal-copy-btn.copied {
            background: #22c55e;
            color: #000;
            border-color: #22c55e;
        }

        .modal-subject {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .modal-title .comments-count {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
        }

        .modal-close-btn {
            background: transparent;
            border: none;
            color: var(--text-color);
            cursor: pointer;
            padding: 4px 8px;
            font-size: 18px;
            line-height: 1;
            opacity: 0.7;
            border-radius: 4px;
        }

        .modal-close-btn:hover {
            opacity: 1;
            background: var(--vscode-toolbar-hoverBackground);
        }

        .modal-body {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }

        .modal-comments-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .modal-comment-item {
            padding: 12px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--border-color);
            border-radius: 6px;
        }

        .modal-comment-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }

        .modal-comment-author {
            font-weight: 600;
            font-size: 13px;
            color: var(--vscode-textLink-foreground);
        }

        .modal-comment-date {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .modal-comment-body {
            font-size: 13px;
            line-height: 1.6;
        }

        .modal-comment-body p {
            margin: 8px 0;
        }

        .modal-comment-body ul,
        .modal-comment-body ol {
            margin: 8px 0;
            padding-left: 24px;
        }

        .modal-comment-body code {
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
        }

        .modal-comment-body pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 10px 0;
        }

        .modal-comment-changes {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed var(--border-color);
        }

        .modal-footer {
            padding: 12px 16px;
            border-top: 1px solid var(--border-color);
            flex-shrink: 0;
        }

        .modal-comment-input-wrapper {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .modal-comment-textarea {
            width: 100%;
            min-height: 100px;
            padding: 10px;
            background: var(--input-bg);
            color: var(--text-color);
            border: 1px solid var(--input-border);
            border-radius: 6px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            resize: vertical;
        }

        .modal-comment-textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .modal-comment-actions {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 10px;
        }

        .expand-btn {
            background: transparent;
            border: none;
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            padding: 2px 6px;
            font-size: 12px;
            opacity: 0.8;
            border-radius: 3px;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .expand-btn:hover {
            opacity: 1;
            background: var(--vscode-toolbar-hoverBackground);
        }

        .no-modal-comments {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 40px 20px;
            font-size: 13px;
        }

        /* ========================================
           Modal Detail Section Styles
           ======================================== */
        .modal-detail-header {
            padding: 12px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            margin-bottom: 16px;
        }

        .modal-detail-row {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 10px;
        }

        .modal-detail-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .modal-detail-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }

        .modal-detail-value {
            font-size: 13px;
            color: var(--text-color);
        }

        .modal-detail-progress {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .modal-detail-progress .progress-bar {
            flex: 1;
            max-width: 200px;
        }

        .modal-detail-progress .progress-text {
            font-size: 12px;
            color: var(--text-color);
            min-width: 35px;
        }

        .modal-description {
            margin-bottom: 16px;
        }

        .modal-section-label {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .modal-description-content {
            background: var(--vscode-editor-background);
            padding: 12px;
            border-radius: 6px;
            border: 1px solid var(--border-color);
            max-height: 200px;
            overflow-y: auto;
            font-size: 13px;
            line-height: 1.6;
        }

        .modal-description-content:empty::after {
            content: 'No description';
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        .modal-description-content h1,
        .modal-description-content h2,
        .modal-description-content h3 {
            margin: 12px 0 6px 0;
            font-weight: 600;
        }

        .modal-description-content h1 { font-size: 1.3em; }
        .modal-description-content h2 { font-size: 1.1em; }
        .modal-description-content h3 { font-size: 1em; }

        .modal-description-content p {
            margin: 8px 0;
        }

        .modal-description-content ul,
        .modal-description-content ol {
            margin: 8px 0;
            padding-left: 24px;
        }

        .modal-description-content code {
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
        }

        .modal-description-content pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 10px 0;
        }

        .modal-description-content blockquote {
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            margin: 10px 0;
            padding-left: 12px;
            color: var(--vscode-textBlockQuote-foreground);
        }

        .modal-description-content a {
            color: var(--vscode-textLink-foreground);
        }

        .modal-comments {
            margin-bottom: 16px;
        }

        .modal-comments-container {
            max-height: 300px;
            overflow-y: auto;
        }

        .modal-actions {
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid var(--border-color);
        }

        /* Modal Select Styles */
        .modal-select {
            background: var(--input-bg);
            color: var(--text-color);
            border: 1px solid var(--input-border);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            min-width: 100px;
        }

        .modal-select:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .modal-select:hover:not(:disabled) {
            background: var(--hover-bg);
        }

        .modal-select-updating {
            opacity: 0.6;
            cursor: wait;
        }

        /* ========================================
           Modal Back Button & Tracker Badge
           ======================================== */
        .modal-back-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 4px 10px;
            font-size: 14px;
            cursor: pointer;
            flex-shrink: 0;
            margin-right: 8px;
            transition: all 0.15s;
        }

        .modal-back-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            border-color: var(--vscode-focusBorder);
        }

        .modal-tracker-badge {
            font-size: 9px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
            flex-shrink: 0;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        /* ========================================
           Unified Hierarchy Display
           ======================================== */
        .modal-hierarchy {
            margin-bottom: 12px;
        }

        .hierarchy-tree {
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background: var(--vscode-editorWidget-background);
            overflow: hidden;
        }

        .hierarchy-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            font-size: 12px;
            border-bottom: 1px solid var(--border-color);
        }

        .hierarchy-item:last-child {
            border-bottom: none;
        }

        .hierarchy-parent,
        .hierarchy-child {
            cursor: pointer;
            transition: background 0.15s;
        }

        .hierarchy-parent:hover,
        .hierarchy-child:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .hierarchy-current {
            background: var(--vscode-list-activeSelectionBackground);
            font-weight: 500;
        }

        .hierarchy-indent {
            width: 14px;
            flex-shrink: 0;
            font-family: monospace;
            color: var(--vscode-descriptionForeground);
            opacity: 0.6;
        }

        .hierarchy-icon {
            width: 14px;
            flex-shrink: 0;
            text-align: center;
            font-size: 10px;
        }

        .hierarchy-parent .hierarchy-icon {
            color: var(--vscode-textLink-foreground);
        }

        .hierarchy-current .hierarchy-icon {
            color: var(--vscode-textLink-activeForeground, var(--vscode-textLink-foreground));
        }

        .hierarchy-child .hierarchy-icon {
            color: var(--vscode-descriptionForeground);
        }

        .hierarchy-id {
            font-family: monospace;
            font-size: 11px;
            color: var(--vscode-textLink-foreground);
            flex-shrink: 0;
        }

        .hierarchy-subject {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .hierarchy-status {
            font-size: 9px;
            padding: 1px 5px;
            border-radius: 4px;
            flex-shrink: 0;
        }

        @container (max-width: 500px) {
            .modal-back-btn {
                padding: 3px 8px;
                font-size: 12px;
            }

            .modal-tracker-badge {
                font-size: 8px;
                padding: 1px 4px;
            }

            .hierarchy-item {
                padding: 5px 8px;
                gap: 4px;
                font-size: 11px;
            }

            .hierarchy-indent,
            .hierarchy-icon {
                width: 12px;
                font-size: 9px;
            }

            .hierarchy-id {
                font-size: 10px;
            }

            .hierarchy-status {
                font-size: 8px;
                padding: 1px 4px;
            }
        }
    `;
}
