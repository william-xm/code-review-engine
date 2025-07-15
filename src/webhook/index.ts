import https from 'https';
import { filterDiffContent } from '../utils/gitlabParse';
import { DIFF_CONTEXT_SIZE } from '../constants/config';
import reviewEngine from '../review-engine';
import commentHook from './commentHook';
import subscribe from '../utils/subscribe';

// 类型定义 (Type definitions)
interface WebhookConfig {
  id: string;
  sha: string;
  type: 'push' | 'merge_request';
}

interface WebhookPayload {
  object_kind: string;
  project_id: string;
  checkout_sha: string;
  commits?: Array<{
    author: { name: string; email: string };
    title: string;
    url: string;
  }>;
}

// 高阶函数用于处理异步操作 (Higher-order function for async operations)
const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`Error in ${fn.name}:`, error);
      return null;
    }
  };
};

// 获取差异内容的函数 (Function to fetch diff content)
const fetchDiffContent = async (config: WebhookConfig): Promise<string | null> => {
  const { id, sha } = config;
  const url = `${process.env.GITLAB_API_URL}/api/v4/projects/${id}/repository/commits/${sha}/diff?diff_context_size=${DIFF_CONTEXT_SIZE}`;

  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'Private-Token': process.env.GITLAB_TOKEN,
        'User-Agent': 'GitLab-Webhook-Processor/1.0'
      },
      timeout: 30000 // 30 second timeout
    }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    request.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });

    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
};

// 处理代码审查流程 (Process code review workflow)
const processCodeReview = async (config: WebhookConfig, diffContent: string): Promise<string | null> => {
  const filteredContent = filterDiffContent(diffContent);

  if (!filteredContent) {
    console.log('No content to review or content below minimum threshold');
    return null;
  }

  const reviewContent = await reviewEngine(filteredContent.toString());

  if (reviewContent) {
    // 并行执行评论和通知 (Execute comment and notification in parallel)
    await Promise.allSettled([
      commentHook(config, reviewContent),
      // 这里可以添加其他通知方式 (Add other notification methods here)
    ]);
  }

  return reviewContent;
};

// 处理推送事件 (Handle push events)
const handlePushEvent = async (payload: WebhookPayload): Promise<void> => {
  const config: WebhookConfig = {
    id: payload.project_id,
    sha: payload.checkout_sha,
    type: 'push'
  };

  console.log(`Processing push event for project ${config.id}, commit ${config.sha}`);

  const diffContent = await fetchDiffContent(config);
  if (!diffContent) {
    console.warn('Failed to fetch diff content');
    return;
  }

  const reviewContent = await processCodeReview(config, diffContent);

  if (reviewContent && payload.commits?.[0]) {
    const commit = payload.commits[0];
    await subscribe({
      author: commit.author,
      title: commit.title,
      url: commit.url,
      content: reviewContent
    });
  }
};

// 事件处理器映射 (Event handler mapping)
const eventHandlers = {
  push: handlePushEvent,
  // 可以添加更多事件类型 (Can add more event types)
  // merge_request: handleMergeRequestEvent,
} as const;

// 主要的 webhook 监听器 (Main webhook listener)
const webhookListener = async (payload: WebhookPayload): Promise<void> => {
  if (!payload || !payload.object_kind) {
    console.warn('Invalid webhook payload received');
    return;
  }

  const { object_kind } = payload;
  console.log(`Received webhook event: ${object_kind}`);

  const handler = eventHandlers[object_kind as keyof typeof eventHandlers];

  if (!handler) {
    console.log(`No handler found for event type: ${object_kind}`);
    return;
  }

  // 使用错误处理包装器 (Use error handling wrapper)
  const safeHandler = withErrorHandling(handler);
  await safeHandler(payload);
};

// 导出安全的 webhook 监听器 (Export safe webhook listener)
export default withErrorHandling(webhookListener);

