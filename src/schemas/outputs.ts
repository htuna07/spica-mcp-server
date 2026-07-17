import { z } from "zod";

// ─── Shared ───────────────────────────────────────────────────────────────────

const ObjectId = z.string().describe("Unique 24-character hex object ID");

// ─── Bucket ───────────────────────────────────────────────────────────────────

export const BucketOutputSchema = {
  _id: ObjectId,
  title: z.string(),
  icon: z.string().optional(),
  description: z.string().optional(),
  primary: z.string().optional(),
  history: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  category: z.string().optional(),
  order: z.number().optional(),
  required: z.array(z.string()).optional(),
  properties: z.record(z.any()).optional(),
  acl: z
    .object({
      read: z.string(),
      write: z.string(),
    })
    .optional(),
  documentSettings: z
    .object({
      countLimit: z.number().optional(),
      limitExceedBehaviour: z.enum(["prevent", "remove"]).optional(),
    })
    .optional(),
  indexes: z
    .array(
      z.object({
        definition: z.record(z.any()),
        options: z.record(z.any()).optional(),
      }),
    )
    .optional(),
};

export const BucketListOutputSchema = {
  buckets: z.array(z.object(BucketOutputSchema).passthrough()),
};

// ─── Bucket Documents ─────────────────────────────────────────────────────────

export const BucketDocumentOutputSchema = {
  _id: ObjectId,
};

export const BucketDocumentListOutputSchema = {
  documents: z.array(z.record(z.any())),
};

export const PaginatedBucketDataOutputSchema = {
  meta: z.object({ total: z.number() }),
  data: z.array(z.record(z.any())),
};

export const ExportBucketDataOutputSchema = {
  filePath: z.string().describe("Absolute path to the written file"),
  format: z.enum(["json", "csv"]),
  totalDocuments: z.number().int().describe("Number of documents written to the file"),
};

const ImportResultSchema = z.discriminatedUnion("status", [
  z.object({
    id: z.string(),
    status: z.literal("success"),
    insertedId: z.string(),
  }),
  z.object({
    id: z.string(),
    status: z.literal("failure"),
    error: z.string(),
  }),
]);

export const ImportBucketDataOutputSchema = {
  totalProcessed: z.number().int(),
  successCount: z.number().int(),
  failureCount: z.number().int(),
  results: z.array(ImportResultSchema).describe("Per-document insert result"),
};

// ─── Env Var ──────────────────────────────────────────────────────────────────

export const EnvVarOutputSchema = {
  _id: ObjectId,
  key: z.string(),
  value: z.string(),
  updated_at: z.string().optional(),
};

export const EnvVarListOutputSchema = {
  env_vars: z.array(z.object(EnvVarOutputSchema).passthrough()),
};

// ─── Secret ───────────────────────────────────────────────────────────────────

export const SecretOutputSchema = {
  _id: ObjectId,
  key: z.string(),
  updated_at: z.string().optional(),
};

export const SecretListOutputSchema = {
  secrets: z.array(z.object(SecretOutputSchema).passthrough()),
};

// ─── Function ─────────────────────────────────────────────────────────────────

const TriggerOutputSchema = z.object({
  type: z.string(),
  active: z.boolean().optional(),
  options: z.record(z.any()),
});

export const FunctionOutputSchema = {
  _id: ObjectId,
  name: z.string(),
  description: z.string().optional(),
  triggers: z.record(TriggerOutputSchema).optional(),
  timeout: z.number(),
  language: z.string(),
  env_vars: z
    .array(
      z.union([
        z.string(),
        z.object({ _id: z.string(), key: z.string(), value: z.string() }),
      ]),
    )
    .optional(),
  secrets: z
    .array(
      z.union([
        z.string(),
        z.object({ _id: z.string(), key: z.string(), value: z.string() }),
      ]),
    )
    .optional(),
  memoryLimit: z.number().optional(),
  order: z.number().optional(),
};

export const FunctionListOutputSchema = {
  functions: z.array(z.object(FunctionOutputSchema).passthrough()),
};

export const FunctionIndexOutputSchema = {
  index: z.string().describe("Source code of the function"),
};

export const FunctionDependenciesOutputSchema = {
  dependencies: z.array(
    z.object({
      name: z.string(),
      version: z.string(),
    }),
  ).describe("List of installed packages with their versions"),
};

export const FunctionLogOutputSchema = {
  _id: ObjectId,
  function: z.string(),
  event_id: z.string().optional(),
  channel: z.string().optional(),
  content: z.string(),
  level: z.number().optional(),
  created_at: z.string().optional(),
};

export const FunctionLogListOutputSchema = {
  logs: z.array(z.object(FunctionLogOutputSchema).passthrough()),
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

const PolicyStatementOutputSchema = z.object({
  action: z.string(),
  module: z.string(),
  resource: z
    .object({
      include: z.array(z.string()),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
});

export const PolicyOutputSchema = {
  _id: ObjectId,
  name: z.string(),
  description: z.string().optional(),
  statement: z.array(PolicyStatementOutputSchema),
  system: z.boolean().optional(),
};

export const PolicyListOutputSchema = {
  policies: z.array(z.object(PolicyOutputSchema).passthrough()),
};

export const ApiKeyOutputSchema = {
  _id: ObjectId,
  name: z.string(),
  description: z.string().nullish(),
  active: z.boolean(),
  key: z.string().optional(),
  policies: z.array(z.string()).optional(),
};

export const ApiKeyListOutputSchema = {
  apikeys: z.array(z.object(ApiKeyOutputSchema).passthrough()),
};

export const IdentityOutputSchema = {
  _id: ObjectId,
  identifier: z.string(),
  policies: z.array(z.string()).optional(),
  attributes: z.record(z.any()).optional(),
  failedAttempts: z.array(z.any()).optional(),
  lastLogin: z.string().nullish(),
  deactivateJwtsBefore: z.number().optional(),
  authFactor: z
    .object({
      type: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      config: z.record(z.any()).optional(),
    })
    .optional(),
};

export const IdentityListOutputSchema = {
  identities: z.array(z.object(IdentityOutputSchema).passthrough()),
};

export const UserOutputSchema = {
  _id: ObjectId,
  username: z.string().optional(),
  policies: z.array(z.string()).optional(),
  failedAttempts: z.array(z.any()).optional(),
  lastLogin: z.string().nullish(),
  deactivateJwtsBefore: z.number().optional(),
};

export const UserListOutputSchema = {
  users: z.array(z.object(UserOutputSchema).passthrough()),
};

// ─── Storage ──────────────────────────────────────────────────────────────────

export const StorageObjectOutputSchema = {
  _id: ObjectId,
  name: z.string(),
  url: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  content: z
    .object({
      type: z.string().describe("MIME type"),
      size: z.union([z.number(), z.string()]).optional().describe("Size in bytes"),
    })
    .optional(),
};

export const StorageObjectListOutputSchema = {
  objects: z.array(z.object(StorageObjectOutputSchema).passthrough()),
};

// ─── Activity ─────────────────────────────────────────────────────────────────

export const ActivityOutputSchema = {
  _id: ObjectId,
  identifier: z.string().optional(),
  username: z.string().optional(),
  action: z.number().optional(),
  resource: z.array(z.any()).optional(),
  created_at: z.string().optional(),
};

export const ActivityListOutputSchema = {
  activities: z.array(z.object(ActivityOutputSchema).passthrough()),
};

// ─── Version Control ──────────────────────────────────────────────────────────

export const VCCommandOutputSchema = {
  command: z.string(),
  params: z.record(z.any()).optional(),
};

export const VCCommandListOutputSchema = {
  commands: z.array(z.record(z.any())),
};

export const VCCommandResultOutputSchema = {
  result: z.any(),
};

// ─── Profile / Debug ──────────────────────────────────────────────────────────

export const ProfileListOutputSchema = {
  entries: z.array(
    z.object({
      op: z.any().optional(),
      ns: z.any().optional(),
      command: z.any().optional(),
      keysExamined: z.any().optional(),
      docsExamined: z.any().optional(),
      numYield: z.any().optional(),
      locks: z.any().optional(),
      millis: z.any().optional(),
      planSummary: z.any().optional(),
      ts: z.any().optional(),
      client: z.any().optional(),
      appName: z.any().optional(),
      allUsers: z.any().optional(),
      user: z.any().optional(),
    }).passthrough(),
  ),
};

// ─── Success message ──────────────────────────────────────────────────────────

export const SuccessMessageOutputSchema = {
  message: z.string().describe("Success status message"),
};
