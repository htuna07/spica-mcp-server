// ─── Policy ───────────────────────────────────────────────────────────────────

export interface PolicyStatement {
  action: string;
  module: string;
  resource?: { include: string[]; exclude: string[] };
}

export interface PolicyBase {
  _id?: string;
  name: string;
  description?: string;
  statement: PolicyStatement[];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface ApiKey {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
  policies?: string[];
  key?: string;
}

export interface Identity {
  _id: string;
  identifier: string;
  policies?: string[];
  failedAttempts?: unknown[];
  lastLogin?: string;
}

// ─── Bucket ───────────────────────────────────────────────────────────────────

export interface BucketACL {
  read: string;
  write: string;
}

export interface BucketDocumentSettings {
  countLimit?: number;
  limitExceedBehaviour?: "prevent" | "remove";
}

export interface BucketIndex {
  definition: Record<string, unknown>;
  options?: Record<string, unknown>;
}

// ─── Function ─────────────────────────────────────────────────────────────────

export interface Trigger {
  type: string;
  active?: boolean;
  options: Record<string, unknown>;
}

export interface EnvVar {
  _id?: string;
  key: string;
  value: string;
}

export interface Secret {
  _id?: string;
  key: string;
  value: string;
}

export interface SpicaFunction {
  _id: string;
  name: string;
  description?: string;
  triggers: Record<string, Trigger>;
  timeout: number;
  language: string;
  env_vars?: Array<string | { _id: string; key: string; value: string }>;
  secrets?: Array<string | { _id: string; key: string; value: string }>;
  memoryLimit?: number;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export interface StorageContent {
  type: string;
  data: string;
}

export interface StorageObject {
  _id?: string;
  name: string;
  content: StorageContent;
}

// ─── HTTP Client ──────────────────────────────────────────────────────────────

export interface RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
}
