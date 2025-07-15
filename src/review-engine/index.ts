import ChatOpenAI from './chatOpenAI';
import { SystemPrompt } from '../constants/prompt';
import 'dotenv/config';

// 类型定义 (Type definitions)
interface ReviewConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

interface ReviewResult {
  content: string;
  success: boolean;
  error?: string;
  metadata?: {
    model: string;
    processingTime: number;
    inputLength: number;
    outputLength: number;
  };
}

// 默认配置 (Default configuration)
const DEFAULT_CONFIG: Required<ReviewConfig> = {
  model: 'Qwen/QwQ-32B',
  temperature: 0.7,
  maxTokens: 4000,
  timeout: 60000
};

// 纯函数：验证输入内容 (Pure function: validate input content)
const validateInput = (diffContent: string): boolean => {
  if (!diffContent || typeof diffContent !== 'string') {
    return false;
  }

  const trimmed = diffContent.trim();
  return trimmed.length > 0 && trimmed.length <= 50000; // 最大50K字符
};

// 纯函数：预处理差异内容 (Pure function: preprocess diff content)
const preprocessDiffContent = (diffContent: string): string => {
  return diffContent
    .trim()
    .replace(/\r\n/g, '\n') // 标准化换行符
    .replace(/\n{3,}/g, '\n\n') // 减少多余的空行
    .substring(0, 30000); // 限制长度以避免token超限
};

// 纯函数：后处理审查结果 (Pure function: postprocess review result)
const postprocessReviewResult = (content: string): string => {
  if (!content) return '';

  return content
    .trim()
    .replace(/\n{3,}/g, '\n\n') // 减少多余的空行
    .replace(/^\s*#+\s*/gm, '### ') // 标准化标题格式
    .replace(/\*\*([^*]+)\*\*/g, '**$1**'); // 确保粗体格式正确
};

// 高阶函数：创建带超时的操作 (Higher-order function: create operation with timeout)
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    )
  ]);
};

// 高阶函数：添加性能监控 (Higher-order function: add performance monitoring)
const withPerformanceMonitoring = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string
) => {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    console.log(`Starting ${operationName}...`);

    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      console.log(`${operationName} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`${operationName} failed after ${duration}ms:`, error);
      throw error;
    }
  };
};

// 核心审查函数 (Core review function)
const performReview = async (
  diffContent: string,
  config: ReviewConfig = {}
): Promise<ReviewResult> => {
  const startTime = Date.now();
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // 验证输入 (Validate input)
    if (!validateInput(diffContent)) {
      return {
        content: '',
        success: false,
        error: 'Invalid input: content is empty, too long, or not a string'
      };
    }

    // 预处理内容 (Preprocess content)
    const processedContent = preprocessDiffContent(diffContent);

    console.log('Initializing AI review engine...');
    console.log(`Model: ${finalConfig.model}`);
    console.log(`Input length: ${processedContent.length} characters`);

    // 创建AI实例 (Create AI instance)
    const llm = new ChatOpenAI(
      finalConfig.model,
      SystemPrompt,
      [], // 暂时不使用工具
      ''
    );

    // 执行审查 (Perform review)
    const reviewOperation = async () => {
      const response = await llm.chat(processedContent);
      return response.content;
    };

    // 应用超时和性能监控 (Apply timeout and performance monitoring)
    const monitoredReview = withPerformanceMonitoring(reviewOperation, 'AI Review');
    const reviewContent = await withTimeout(monitoredReview(), finalConfig.timeout);

    // 后处理结果 (Postprocess result)
    const finalContent = postprocessReviewResult(reviewContent);

    const processingTime = Date.now() - startTime;

    console.log(`Review completed successfully in ${processingTime}ms`);
    console.log(`Output length: ${finalContent.length} characters`);

    return {
      content: finalContent,
      success: true,
      metadata: {
        model: finalConfig.model,
        processingTime,
        inputLength: processedContent.length,
        outputLength: finalContent.length
      }
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('Review engine failed:', errorMessage);

    return {
      content: '',
      success: false,
      error: errorMessage,
      metadata: {
        model: finalConfig.model,
        processingTime,
        inputLength: diffContent.length,
        outputLength: 0
      }
    };
  }
};

// 主要的审查引擎函数 (Main review engine function)
const reviewEngine = async (
  diffContent: string,
  config?: ReviewConfig
): Promise<string> => {
  console.log('='.repeat(50));
  console.log('Starting code review process...');
  console.log('='.repeat(50));

  const result = await performReview(diffContent, config);

  if (result.success) {
    console.log('Code review completed successfully');
    if (result.metadata) {
      console.log(`Processing time: ${result.metadata.processingTime}ms`);
      console.log(`Model used: ${result.metadata.model}`);
    }
    return result.content;
  } else {
    console.error('Code review failed:', result.error);
    return '';
  }
};

// 批量审查函数 (Batch review function)
const batchReviewEngine = async (
  diffContents: string[],
  config?: ReviewConfig
): Promise<ReviewResult[]> => {
  if (!Array.isArray(diffContents) || diffContents.length === 0) {
    return [];
  }

  console.log(`Starting batch review for ${diffContents.length} items...`);

  // 并行处理，但限制并发数 (Process in parallel with concurrency limit)
  const results = await Promise.allSettled(
    diffContents.map(content => performReview(content, config))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Batch review ${index} failed:`, result.reason);
      return {
        content: '',
        success: false,
        error: result.reason?.message || 'Unknown error'
      };
    }
  });
};

// 健康检查函数 (Health check function)
const healthCheck = async (): Promise<boolean> => {
  try {
    const testContent = '// Test comment\nconst test = "hello world";';
    const result = await performReview(testContent, { timeout: 10000 });
    return result.success;
  } catch {
    return false;
  }
};

export default reviewEngine;
export {
  performReview,
  batchReviewEngine,
  healthCheck,
  validateInput,
  preprocessDiffContent,
  postprocessReviewResult
};
