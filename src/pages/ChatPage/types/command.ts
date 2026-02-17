export type CommandType = 'workflow' | 'skill' | 'mcp';

export interface CommandItem {
  id: string;
  name: string;
  displayName: string;
  description: string;
  type: CommandType;
  category?: string;
  tags?: string[];

  metadata: {
    // Workflow
    filename?: string;
    size?: number;
    source?: 'global' | 'workspace';

    // Skill
    prompt?: string;
    toolRefs?: string[];
    workflowRefs?: string[];
    visibility?: 'public' | 'private';

    // MCP
    serverId?: string;
    serverName?: string;
    originalName?: string;
  };
}

export interface CommandListResponse {
  commands: CommandItem[];
  total: number;
}
