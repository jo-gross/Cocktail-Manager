interface WorkspaceMapping {
  workspaceId: string;
  workspaceName?: string;
  mappings: {
    oidcGroup: string;
    role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'USER';
  }[];
}

let parsedMappings: WorkspaceMapping[] | null = null;

export const getExternalWorkspaceMappings = (): WorkspaceMapping[] => {
  if (parsedMappings) {
    return parsedMappings;
  }

  const envValue = process.env.EXTERNAL_WORKSPACE_MAPPINGS;
  if (!envValue) {
    parsedMappings = [];
    return parsedMappings;
  }

  try {
    parsedMappings = JSON.parse(envValue) as WorkspaceMapping[];
  } catch (error) {
    console.error('Failed to parse EXTERNAL_WORKSPACE_MAPPINGS:', error);
    parsedMappings = [];
  }

  return parsedMappings;
};

export const isWorkspaceExternallyManaged = (workspaceId: string): boolean => {
  if (process.env.EXTERNAL_WORKSPACE_MANAGEMENT !== 'true') {
    return false;
  }
  const mappings = getExternalWorkspaceMappings();
  return mappings.some((m) => m.workspaceId === workspaceId);
};
