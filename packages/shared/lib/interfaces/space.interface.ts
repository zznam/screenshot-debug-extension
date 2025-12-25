import type { Slice, Workspace } from './index.js';

export interface Space {
  id: string;
  externalId: string | null;
  internalId: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  name: string;
  metadata: string | null;
  description: string | null;
  workspaceId: string;
  workspace: Workspace;
  slices: Slice[];
}
