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

// ── AI classification ─────────────────────────────────────────
export interface ClaudeClassification {
  personHint: string | null;
  category: string;
  subcategory: string | null;
  displayName: string;
  confidence: number;
  expiryDate: string | null; // YYYY-MM-DD
  reasoning: string;
}

// ── Person matching ───────────────────────────────────────────
export interface PersonMatch {
  personId: string;
  displayName: string;
  matchLayer: 'exact' | 'synonym' | 'fuzzy';
  confidenceMultiplier: number;
}

// ── Web Push ──────────────────────────────────────────────────
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  documentId?: string;
  data?: Record<string, unknown>;
}

// ── DynamoDB person record ────────────────────────────────────
export interface PersonRecord {
  PK: string; // VAULT#{vaultId}
  SK: string; // PERSON#{personId}
  personId: string;
  displayName: string;
  relationship?: string;
  pushSubscription?: PushSubscription;
  pushSubscriptionUpdatedAt?: string;
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
  suggestedExpiryDate?: string | null;
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
  llmSuggestion?: ClaudeClassification;
  llmConfidence?: number;
  personMatchLayer?: 'exact' | 'synonym' | 'fuzzy';
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
