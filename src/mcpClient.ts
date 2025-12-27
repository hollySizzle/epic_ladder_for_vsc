import axios, { AxiosInstance } from 'axios';
import {
    JsonRpcRequest,
    JsonRpcResponse,
    McpToolResult,
    McpClientConfig,
    GetProjectStructureResponse,
    ListVersionsResponse,
    GetIssueDetailResponse,
    AddIssueCommentResponse,
    UpdateIssueStatusResponse,
    UpdateIssueAssigneeResponse,
    ListStatusesResponse,
    ListProjectMembersResponse
} from './types';

export class McpClient {
    private httpClient: AxiosInstance;
    private requestId: number = 0;
    private defaultProject?: string;

    constructor(config: McpClientConfig) {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Redmine-API-Key': config.apiKey
        };

        if (config.defaultProject) {
            headers['X-Default-Project'] = config.defaultProject;
            this.defaultProject = config.defaultProject;
        }

        this.httpClient = axios.create({
            baseURL: config.serverUrl,
            timeout: config.timeout ?? 30000,
            headers
        });
    }

    private getNextRequestId(): number {
        return ++this.requestId;
    }

    private async callTool<T>(
        toolName: string,
        args: Record<string, unknown> = {}
    ): Promise<T> {
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id: this.getNextRequestId(),
            method: 'tools/call',
            params: {
                name: toolName,
                arguments: args
            }
        };

        const response = await this.httpClient.post<JsonRpcResponse<McpToolResult>>('', request);

        if (response.data.error) {
            throw new McpError(
                response.data.error.code,
                response.data.error.message,
                response.data.error.data
            );
        }

        if (!response.data.result) {
            throw new McpError(-32603, 'Empty result from MCP server');
        }

        const result = response.data.result;

        if (result.isError) {
            const errorText = result.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n');
            throw new McpError(-32000, errorText);
        }

        const textContent = result.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('');

        try {
            return JSON.parse(textContent) as T;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown parse error';
            throw new McpError(-32700, `Failed to parse MCP response: ${errorMessage}`);
        }
    }

    /**
     * プロジェクトのEpic階層構造を取得
     */
    async getProjectStructure(params: {
        project_id?: string;
        version_id?: string;
        status?: 'open' | 'closed';
        include_closed?: boolean;
        max_depth?: number;
    } = {}): Promise<GetProjectStructureResponse> {
        return this.callTool<GetProjectStructureResponse>(
            'get_project_structure_tool',
            params
        );
    }

    /**
     * プロジェクト内のバージョン一覧を取得
     */
    async listVersions(params: {
        project_id?: string;
        status?: 'open' | 'locked' | 'closed' | 'all';
        sort?: 'effective_date_asc' | 'effective_date_desc' | 'name_asc' | 'name_desc';
        limit?: number;
    } = {}): Promise<ListVersionsResponse> {
        return this.callTool<ListVersionsResponse>(
            'list_versions_tool',
            params
        );
    }

    /**
     * チケットの詳細情報を取得
     */
    async getIssueDetail(issueId: string): Promise<GetIssueDetailResponse> {
        return this.callTool<GetIssueDetailResponse>(
            'get_issue_detail_tool',
            { issue_id: issueId }
        );
    }

    /**
     * チケットにコメントを追加
     */
    async addIssueComment(
        issueId: string,
        comment: string
    ): Promise<AddIssueCommentResponse> {
        return this.callTool<AddIssueCommentResponse>(
            'add_issue_comment_tool',
            {
                issue_id: issueId,
                comment: comment
            }
        );
    }

    /**
     * チケットのステータスを更新
     */
    async updateIssueStatus(
        issueId: string,
        statusName: string,
        confirmed: boolean = false
    ): Promise<UpdateIssueStatusResponse> {
        return this.callTool<UpdateIssueStatusResponse>(
            'update_issue_status_tool',
            {
                issue_id: issueId,
                status_name: statusName,
                confirmed: confirmed
            }
        );
    }

    /**
     * チケットの担当者を更新
     */
    async updateIssueAssignee(
        issueId: string,
        assignedToId: string | null
    ): Promise<UpdateIssueAssigneeResponse> {
        return this.callTool<UpdateIssueAssigneeResponse>(
            'update_issue_assignee_tool',
            {
                issue_id: issueId,
                assigned_to_id: assignedToId
            }
        );
    }

    /**
     * ステータス一覧を取得
     */
    async listStatuses(params: {
        project_id?: string;
        include_closed?: boolean;
    } = {}): Promise<ListStatusesResponse> {
        return this.callTool<ListStatusesResponse>(
            'list_statuses_tool',
            params
        );
    }

    /**
     * プロジェクトメンバー一覧を取得
     */
    async listProjectMembers(params: {
        project_id?: string;
        role_name?: string;
        limit?: number;
    } = {}): Promise<ListProjectMembersResponse> {
        return this.callTool<ListProjectMembersResponse>(
            'list_project_members_tool',
            params
        );
    }

    /**
     * MCPサーバーへの接続をテスト
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.listVersions({ limit: 1 });
            return true;
        } catch {
            return false;
        }
    }
}

export class McpError extends Error {
    constructor(
        public readonly code: number,
        message: string,
        public readonly data?: unknown
    ) {
        super(message);
        this.name = 'McpError';
    }
}
