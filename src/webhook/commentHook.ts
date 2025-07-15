import https from 'https';

// 类型定义 (Type definitions)
interface CommentConfig {
  id: string;
  sha: string;
  type?: string;
}

interface CommentResponse {
  id: string;
  note: string;
  created_at: string;
  updated_at: string;
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

// 创建评论的函数 (Function to create comment)
const createComment = async (config: CommentConfig, note: string): Promise<CommentResponse | null> => {
  const { id, sha } = config;

  if (!note || note.trim().length === 0) {
    throw new Error('Comment note cannot be empty');
  }

  const postData = JSON.stringify({
    note: note.trim()
  });

  const options = {
    hostname: process.env.GITLAB_API_HOST,
    path: `/api/v4/projects/${id}/repository/commits/${sha}/comments`,
    headers: {
      'Private-Token': process.env.GITLAB_TOKEN,
      'Content-Type': 'application/json',
      'User-Agent': 'GitLab-Comment-Bot/1.0',
      'Content-Length': Buffer.byteLength(postData)
    },
    method: 'POST',
    rejectUnauthorized: false,
    timeout: 30000 // 30 second timeout
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 201) {
            const response: CommentResponse = JSON.parse(data);
            console.log(`Comment created successfully: ${response.id}`);
            resolve(response);
          } else {
            console.error(`Failed to create comment: HTTP ${res.statusCode}`);
            console.error('Response:', data);
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
          reject(new Error('Invalid response format'));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    // 写入请求数据 (Write request data)
    req.write(postData);
    req.end();
  });
};

// 主要的评论钩子函数 (Main comment hook function)
const commentHook = async (config: CommentConfig, note: string): Promise<CommentResponse | null> => {
  try {
    // 验证配置 (Validate configuration)
    if (!config.id || !config.sha) {
      throw new Error('Missing required configuration: id and sha are required');
    }

    if (!process.env.GITLAB_API_HOST || !process.env.GITLAB_TOKEN) {
      throw new Error('Missing required environment variables: GITLAB_API_HOST and GITLAB_TOKEN');
    }

    console.log(`Creating comment for project ${config.id}, commit ${config.sha}`);

    // 使用超时包装器 (Use timeout wrapper)
    const result = await withTimeout(createComment(config, note), 30000);

    return result;
  } catch (error) {
    console.error('Comment hook failed:', error);
    return null;
  }
};

export default commentHook;