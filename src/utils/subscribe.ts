import https from 'https';
import { FEISHU_WEBHOOK } from '../constants/config';

// 类型定义 (Type definitions)
interface Author {
  name: string;
  email: string;
}

interface SubscribeConfig {
  author: Author;
  title: string;
  url: string;
  content: string;
}

interface WebhookResponse {
  success: boolean;
  message?: string;
  data?: any;
}

// 高阶函数用于处理异步操作 (Higher-order function for async operations)
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    )
  ]);
};

// 验证配置的纯函数 (Pure function to validate configuration)
const validateConfig = (config: SubscribeConfig): boolean => {
  if (!config) return false;

  const { author, title, url, content } = config;

  return !!(
    author &&
    typeof author.name === 'string' &&
    typeof author.email === 'string' &&
    typeof title === 'string' &&
    typeof url === 'string' &&
    typeof content === 'string' &&
    title.trim().length > 0 &&
    url.trim().length > 0 &&
    content.trim().length > 0
  );
};

// 格式化消息内容的纯函数 (Pure function to format message content)
const formatMessage = (config: SubscribeConfig): any => {
  const { author, title, url, content } = config;

  return {
    msg_type: "text",
    content: {
      text: `🔍 代码审查通知 (Code Review Notification)\n\n` +
            `📝 提交标题 (Commit Title): ${title}\n` +
            `👤 作者 (Author): ${author.name} <${author.email}>\n` +
            `🔗 链接 (Link): ${url}\n\n` +
            `📋 审查内容 (Review Content):\n${content}`
    }
  };
};

// 发送 webhook 请求的函数 (Function to send webhook request)
const sendWebhookRequest = async (data: SubscribeConfig): Promise<WebhookResponse> => {
  const message = formatMessage(data);
  const postData = JSON.stringify(message);

  const options = {
    ...FEISHU_WEBHOOK,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Code-Review-Bot/1.0'
    },
    method: 'POST',
    timeout: 10000 // 10 second timeout
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);

          if (res.statusCode === 200) {
            console.log('Webhook sent successfully');
            resolve({
              success: true,
              data: response
            });
          } else {
            console.error(`Webhook failed: HTTP ${res.statusCode}`);
            console.error('Response:', responseData);
            resolve({
              success: false,
              message: `HTTP ${res.statusCode}: ${res.statusMessage}`
            });
          }
        } catch (parseError) {
          console.error('Failed to parse webhook response:', parseError);
          resolve({
            success: false,
            message: 'Invalid response format'
          });
        }
      });
    });

    req.on('error', (error) => {
      console.error('Webhook request error:', error);
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
};

// 主要的订阅函数 (Main subscribe function)
const subscribe = async (data: SubscribeConfig): Promise<WebhookResponse> => {
  try {
    // 验证输入数据 (Validate input data)
    if (!validateConfig(data)) {
      console.error('Invalid subscription configuration');
      return {
        success: false,
        message: 'Invalid configuration: missing required fields'
      };
    }

    // 检查环境变量 (Check environment variables)
    if (!FEISHU_WEBHOOK.hostname || !FEISHU_WEBHOOK.path) {
      console.error('Missing Feishu webhook configuration');
      return {
        success: false,
        message: 'Missing webhook configuration'
      };
    }

    console.log(`Sending notification for commit: ${data.title}`);

    // 使用超时包装器发送请求 (Send request with timeout wrapper)
    const result = await withTimeout(sendWebhookRequest(data), 15000);

    return result;
  } catch (error) {
    console.error('Subscribe function failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 批量通知函数 (Batch notification function)
const batchSubscribe = async (configs: SubscribeConfig[]): Promise<WebhookResponse[]> => {
  if (!Array.isArray(configs) || configs.length === 0) {
    return [];
  }

  console.log(`Sending ${configs.length} notifications...`);

  // 并行发送通知，但限制并发数 (Send notifications in parallel with concurrency limit)
  const results = await Promise.allSettled(
    configs.map(config => subscribe(config))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Batch notification ${index} failed:`, result.reason);
      return {
        success: false,
        message: result.reason?.message || 'Unknown error'
      };
    }
  });
};

export default subscribe;
export { batchSubscribe, validateConfig, formatMessage };