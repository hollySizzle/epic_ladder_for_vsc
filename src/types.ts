// MCP JSON-RPC Types
export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number | string;
    method: string;
    params?: Record<string, unknown>;
}

export interface JsonRpcResponse<T = unknown> {
    jsonrpc: '2.0';
    id: number | string;
    result?: T;
    error?: JsonRpcError;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}

// MCP Tool Call Types
export interface McpToolCallParams {
    name: string;
    arguments: Record<string, unknown>;
}

export interface McpToolResult<T = unknown> {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
    _meta?: Record<string, unknown>;
    parsedResult?: T;
}

// Redmine Issue Types
export interface RedmineUser {
    id: string;
    name: string;
}

export interface RedmineTracker {
    id: string;
    name: string;
}

export interface RedmineStatus {
    id: string;
    name: string;
    is_closed: boolean;
}

export interface RedminePriority {
    id: string;
    name: string;
}

export interface RedmineVersion {
    id: string;
    name: string;
    status: 'open' | 'locked' | 'closed';
    effective_date: string;
    description?: string;
}

export interface RedmineParent {
    id: string;
    subject: string;
}

export interface RedmineJournalDetail {
    property: string;
    name: string;
    old_value: string | null;
    new_value: string | null;
}

export interface RedmineJournal {
    id: string;
    user: RedmineUser;
    created_on: string;
    notes: string;
    details: RedmineJournalDetail[];
}

export interface RedmineIssue {
    id: string;
    subject: string;
    description: string;
    tracker: RedmineTracker;
    status: RedmineStatus;
    priority: RedminePriority;
    author: RedmineUser;
    assigned_to?: RedmineUser;
    fixed_version?: RedmineVersion;
    parent?: RedmineParent;
    created_on: string;
    updated_on: string;
    start_date?: string;
    due_date?: string;
    done_ratio: number;
    url: string;
}

export interface RedmineIssueChild {
    id: string;
    subject: string;
    tracker: RedmineTracker;
    status: RedmineStatus;
}

// Tool Response Types
export interface GetIssueDetailResponse {
    success: boolean;
    issue: RedmineIssue;
    journals: RedmineJournal[];
    journals_count: number;
    children: RedmineIssueChild[];
    children_count: number;
}

export interface ProjectStructureItem {
    id: string;
    subject: string;
    tracker: string;
    status: string;
    assigned_to?: string;
    version?: string;
    children?: ProjectStructureItem[];
}

export interface GetProjectStructureResponse {
    success: boolean;
    project_id: string;
    structure: ProjectStructureItem[];
    total_count: number;
}

export interface ListVersionsResponse {
    success: boolean;
    versions: RedmineVersion[];
    total_count: number;
}

export interface AddIssueCommentResponse {
    success: boolean;
    issue_id: string;
    journal_id: string;
    message: string;
}

export interface UpdateIssueStatusResponse {
    success: boolean;
    issue_id: string;
    old_status: string;
    new_status: string;
    message: string;
}

// MCP Client Configuration
export interface McpClientConfig {
    serverUrl: string;
    apiKey: string;
    defaultProject?: string;
    timeout?: number;
}
