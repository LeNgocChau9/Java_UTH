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
  commitHash?: string | null;
  commitUrl?: string | null;
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
  templateId?: number | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  structureWarning?: boolean;
  missingHeadings?: string[];
}

export interface ImportExternalDocPayload {
  repoId: number;
  title: string;
  targetPath?: string;
  sourceType: "GOOGLE_DOCS" | "CONFLUENCE" | "JIRA" | "MARKDOWN" | "DOCX" | string;
  sourceUrlOrId?: string;
  content?: string;
  templateId?: number;
}

export interface GroundingEvidenceItem {
  linkId?: number;
  documentId?: number;
  entityId?: number | null;
  filePath: string;
  className?: string | null;
  methodName?: string | null;
  signature?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  commitHash?: string | null;
  createdAt?: string;
}
export interface DocumentDetail extends DocumentItem {
  versionHistory: DocumentVersionItem[];
}

export interface CollectionOwnerItem {
  userId: number;
  fullName: string;
  email: string;
  role: string;
  roleLabel?: string;
  avatarUrl?: string | null;
}

export interface DocCollection {
  id: number;
  name: string;
  description?: string | null;
  moduleTag?: string | null;
  ownerId?: number | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerRole?: string | null;
  documentCount?: number;
  documentIds?: number[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveCollectionPayload {
  name: string;
  description?: string;
  moduleTag?: string;
  ownerId?: number | null;
  ownerName?: string;
  ownerEmail?: string;
  ownerRole?: string;
  documentIds?: number[];
}

export interface CreateDocumentPayload {
  repoId: number;
  collectionId?: number | null;
  title: string;
  targetPath?: string;
  content: string;
  actorRole?: string;
  triggerType?: string;
  templateId?: number;
}

export interface UpdateDocumentPayload {
  title?: string;
  targetPath?: string;
  collectionId?: number | null;
  content: string;
  actorRole?: string;
  triggerType?: string;
}

export interface VersionIntegrityDetail {
  versionNum: number;
  storedHash: string;
  computedHash: string;
  prevHash: string;
  expectedPrevHash: string;
  contentValid: boolean;
  chainValid: boolean;
  status: "VALID" | "CONTENT_TAMPERED" | "CHAIN_BROKEN" | "INVALID" | string;
}

export interface IntegrityCheckResult {
  docId: number;
  totalVersions: number;
  valid: boolean;
  message: string;
  issues: string[];
  chainDetails?: VersionIntegrityDetail[];
}

export interface RollbackResponse {
  docId: number;
  targetVersion: number;
  newVersion: number;
  message: string;
  version?: DocumentVersionItem;
}

export interface RollbackRequestPayload {
  targetVersion: number;
  reason?: string;
  actorRole?: string;
}

export interface DocumentAuditLogItem {
  logId: number;
  actorId: number | null;
  action: string;
  resourceType: string;
  resourceId: string;
  detail?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface ChangelogItem {
  id: number;
  documentId: number;
  documentTitle?: string | null;
  repoId?: number | null;
  versionId: number | null;
  actorId: number | null;
  actorRole: "AI" | "DEV" | "STAFF" | "MANAGER" | string;
  changeSummary: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
