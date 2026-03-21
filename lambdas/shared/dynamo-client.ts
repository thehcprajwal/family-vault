import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { DocumentKeys, VersionKeys } from './types';

export const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

export {
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
  marshall,
  unmarshall,
};

// ── Key helpers ───────────────────────────────────────────────
export const keys = {
  vault: (vaultId: string) => ({ PK: `VAULT#${vaultId}`, SK: 'METADATA' }),
  person: (vaultId: string, personId: string) => ({
    PK: `VAULT#${vaultId}`,
    SK: `PERSON#${personId}`,
  }),
  category: (vaultId: string, categoryId: string) => ({
    PK: `VAULT#${vaultId}`,
    SK: `CATEGORY#${categoryId}`,
  }),
  document: (vaultId: string, documentId: string): DocumentKeys => ({
    PK: `VAULT#${vaultId}`,
    SK: `DOC#${documentId}`,
  }),
  version: (vaultId: string, documentId: string, versionId: string): VersionKeys => ({
    PK: `VAULT#${vaultId}`,
    SK: `DOC#${documentId}#VER#${versionId}`,
  }),
  statusSK: (status: string, documentId: string): string =>
    `STATUS#${status}#${documentId}`,
  personSK: (personId: string, documentId: string): string =>
    `PERSON#${personId}#${documentId}`,
  categorySK: (categoryId: string, documentId: string): string =>
    `CATEGORY#${categoryId}#${documentId}`,
};
