import { z } from 'zod';

// 基础类型验证 (Basic type validation)
export const EmailSchema = z.string().email('Invalid email format');
export const UrlSchema = z.string().url('Invalid URL format');
export const NonEmptyStringSchema = z.string().min(1, 'String cannot be empty');

// 作者信息验证 (Author information validation)
export const AuthorSchema = z.object({
  name: NonEmptyStringSchema,
  email: EmailSchema,
});

// GitLab差异项验证 (GitLab diff item validation)
export const GitLabDiffItemSchema = z.object({
  new_path: NonEmptyStringSchema,
  old_path: z.string().optional(),
  diff: z.string(),
  new_file: z.boolean().optional(),
  renamed_file: z.boolean().optional(),
  deleted_file: z.boolean().optional(),
});

// Webhook配置验证 (Webhook configuration validation)
export const WebhookConfigSchema = z.object({
  id: NonEmptyStringSchema,
  sha: z.string().regex(/^[a-f0-9]{40}$/, 'Invalid SHA format'),
  type: z.enum(['push', 'merge_request']).optional(),
});

// Webhook负载验证 (Webhook payload validation)
export const WebhookPayloadSchema = z.object({
  object_kind: NonEmptyStringSchema,
  project_id: NonEmptyStringSchema,
  checkout_sha: z.string().regex(/^[a-f0-9]{40}$/, 'Invalid SHA format'),
  commits: z.array(z.object({
    author: AuthorSchema,
    title: NonEmptyStringSchema,
    url: UrlSchema,
  })).optional(),
});

// 订阅配置验证 (Subscription configuration validation)
export const SubscribeConfigSchema = z.object({
  author: AuthorSchema,
  title: NonEmptyStringSchema,
  url: UrlSchema,
  content: NonEmptyStringSchema,
});

// 评论配置验证 (Comment configuration validation)
export const CommentConfigSchema = z.object({
  id: NonEmptyStringSchema,
  sha: z.string().regex(/^[a-f0-9]{40}$/, 'Invalid SHA format'),
  type: z.string().optional(),
});

// 审查配置验证 (Review configuration validation)
export const ReviewConfigSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(8000).optional(),
  timeout: z.number().min(1000).max(300000).optional(), // 1s to 5min
});

// 环境变量验证 (Environment variables validation)
export const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(65535)).default('4399'),
  IP_ADDRESS: z.string().ip().optional(),
  GITLAB_API_URL: UrlSchema.optional(),
  GITLAB_API_HOST: NonEmptyStringSchema.optional(),
  GITLAB_TOKEN: NonEmptyStringSchema.optional(),
  SILICONFLOW_TOKEN: NonEmptyStringSchema.optional(),
  SILICONFLOW_BASE_URL: UrlSchema.optional(),
});

// 请求验证 (Request validation)
export const RequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']),
  url: NonEmptyStringSchema,
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  query: z.record(z.string()).optional(),
  params: z.record(z.string()).optional(),
});

// 响应验证 (Response validation)
export const ApiResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.any().optional(),
  timestamp: z.string().datetime().optional(),
});

// 错误响应验证 (Error response validation)
export const ErrorResponseSchema = z.object({
  message: z.string(),
  status: z.number(),
  timestamp: z.string().datetime(),
  path: z.string(),
  method: z.string(),
  stack: z.string().optional(),
});

// 工具调用验证 (Tool call validation)
export const ToolCallSchema = z.object({
  id: NonEmptyStringSchema,
  function: z.object({
    name: NonEmptyStringSchema,
    arguments: z.string(),
  }),
});

// 聊天消息验证 (Chat message validation)
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
});

// 聊天响应验证 (Chat response validation)
export const ChatResponseSchema = z.object({
  content: z.string(),
  toolCalls: z.array(ToolCallSchema),
  reasoning: z.string().optional(),
});

// 审查结果验证 (Review result validation)
export const ReviewResultSchema = z.object({
  content: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  metadata: z.object({
    model: z.string(),
    processingTime: z.number(),
    inputLength: z.number(),
    outputLength: z.number(),
  }).optional(),
});

// 文件统计验证 (File statistics validation)
export const FileStatsSchema = z.object({
  content: z.array(z.string()),
  totalLines: z.number(),
  processedFiles: z.number(),
});

// Webhook响应验证 (Webhook response validation)
export const WebhookResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional(),
});

// 类型导出 (Type exports)
export type Author = z.infer<typeof AuthorSchema>;
export type GitLabDiffItem = z.infer<typeof GitLabDiffItemSchema>;
export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
export type SubscribeConfig = z.infer<typeof SubscribeConfigSchema>;
export type CommentConfig = z.infer<typeof CommentConfigSchema>;
export type ReviewConfig = z.infer<typeof ReviewConfigSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
export type Request = z.infer<typeof RequestSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
export type FileStats = z.infer<typeof FileStatsSchema>;
export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;