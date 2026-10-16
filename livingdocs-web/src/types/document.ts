export type DocumentStatus =
  | "DRAFT"
  | "UNDER_REVIEW_STAFF"
  | "UNDER_REVIEW_MANAGER"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED";

export interface DocumentVersionItem {
  versionId: number;
  docId: number;
  versionNum: number;
  content: string;
  actorRole: "AI" | "DEV" | "STAFF" | "MANAGER" | string;
  triggerType: string;
  hash: string;
  prevHash: string;
  createdAt: string;
}

export interface DocumentItem {
  docId: number;
  collectionId: number | null;
  repoId: number;
  title: string;
  targetPath?: string | null;
  status: DocumentStatus;
  currentVersion: number;
  latestVersion?: DocumentVersionItem | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentItem {
  versionHistory: DocumentVersionItem[];
}

export interface DocCollection {
  id: number;
  name: string;
  description?: string | null;
  documentCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDocumentPayload {
  repoId: number;
  collectionId?: number | null;
  title: string;
  targetPath?: string;
  content: string;
  actorRole?: string;
  triggerType?: string;
}

export interface UpdateDocumentPayload {
  title?: string;
  targetPath?: string;
  collectionId?: number | null;
  content: string;
  actorRole?: string;
  triggerType?: string;
}

export interface IntegrityCheckResult {
  docId: number;
  totalVersions: number;
  valid: boolean;
  message: string;
  issues: string[];
}
