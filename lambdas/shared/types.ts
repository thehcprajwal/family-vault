// ── Document status ──────────────────────────────────────────
export type DocumentStatus = 'PENDING' | 'CONFIRMED' | 'DELETED';
export type VersionStatus =
  | 'PROCESSING'
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'SUPERSEDED'
  | 'FAILED';
export type Role = 'owner' | 'member';

// ── DynamoDB key shapes ───────────────────────────────────────
export interface DocumentKeys {
  PK: string; // VAULT#{vaultId}
  SK: string; // DOC#{documentId}
}

export interface VersionKeys {
  PK: string; // VAULT#{vaultId}
  SK: string; // DOC#{documentId}#VER#{versionId}
}

// ── DynamoDB person record ────────────────────────────────────
export interface PersonRecord {
  PK: string; // VAULT#{vaultId}
  SK: string; // PERSON#{personId}
  personId: string;
  displayName: string;
  relationship?: string;
  createdAt: string;
  updatedAt: string;
}

// ── DynamoDB category record ──────────────────────────────────
export interface CategoryRecord {
  PK: string; // VAULT#{vaultId}
  SK: string; // CATEGORY#{categoryId}
  categoryId: string;
  name: string;
  icon?: string;
  subcategories: string[];
  createdAt: string;
  updatedAt: string;
}

// ── DynamoDB document record ──────────────────────────────────
export interface DocumentRecord extends DocumentKeys {
  documentId: string;
  personId: string | null;
  categoryId: string | null;
  subcategory: string | null;
  displayName: string;
  status: DocumentStatus;
  statusSK: string; // for status-index: STATUS#{status}#{documentId}
  personSK?: string; // for person-index
  categorySK?: string; // for category-index
  expiryDate?: string | null; // for expiry-index
  activeVersionId?: string;
  // AI classification suggestions (pre-confirm)
  suggestedPersonId?: string | null;
  suggestedCategoryId?: string | null;
  suggestedSubcategory?: string | null;
  suggestedDisplayName?: string;
  classificationConfidence?: number;
  createdAt: string;
  updatedAt: string;
}

// ── DynamoDB version record ───────────────────────────────────
export interface VersionRecord extends VersionKeys {
  documentId: string;
  versionId: string;
  status: VersionStatus;
  s3Key: string;
  mimeType: string;
  fileSizeBytes: number;
  originalFilename: string;
  ocrText?: string;
  isPoorQuality?: boolean;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ── JWT claims from API Gateway ───────────────────────────────
export interface JwtClaims {
  sub: string;
  email: string;
  'custom:vaultId': string;
  'custom:role': Role;
}

// ── Textract result ───────────────────────────────────────────
export interface TextractResult {
  text: string;
  avgConfidence: number;
  wordCount: number;
  isPoorQuality: boolean;
}
