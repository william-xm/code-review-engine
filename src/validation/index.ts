import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// 验证结果类型 (Validation result type)
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: z.ZodError;
}

// 高阶函数：创建验证器 (Higher-order function: create validator)
export const createValidator = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): ValidationResult<T> => {
    try {
      const result = schema.parse(data);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          errors: error
        };
      }
      return {
        success: false,
        error: 'Unknown validation error'
      };
    }
  };
};

// 高阶函数：创建安全的验证器 (Higher-order function: create safe validator)
export const createSafeValidator = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): T | null => {
    try {
      return schema.parse(data);
    } catch {
      return null;
    }
  };
};

// 高阶函数：创建中间件验证器 (Higher-order function: create middleware validator)
export const createValidationMiddleware = <T>(
  schema: z.ZodSchema<T>,
  source: 'body' | 'query' | 'params' | 'headers' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const validator = createValidator(schema);
    const result = validator(req[source]);

    if (!result.success) {
      res.status(400).json({
        message: 'Validation failed',
        error: result.error,
        details: result.errors?.errors
      });
      return;
    }

    // 将验证后的数据附加到请求对象 (Attach validated data to request object)
    (req as any)[`validated${source.charAt(0).toUpperCase() + source.slice(1)}`] = result.data;
    next();
  };
};

// 纯函数：格式化验证错误 (Pure function: format validation errors)
export const formatValidationError = (error: z.ZodError): string => {
  return error.errors
    .map(err => {
      const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
      return `${path}${err.message}`;
    })
    .join(', ');
};

// 纯函数：检查是否为有效的环境变量 (Pure function: check if valid environment)
export const isValidEnvironment = (env: string): env is 'development' | 'production' | 'test' => {
  return ['development', 'production', 'test'].includes(env);
};

// 纯函数：检查是否为有效的HTTP方法 (Pure function: check if valid HTTP method)
export const isValidHttpMethod = (method: string): method is 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' => {
  return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].includes(method);
};

// 纯函数：检查是否为有效的SHA (Pure function: check if valid SHA)
export const isValidSha = (sha: string): boolean => {
  return /^[a-f0-9]{40}$/.test(sha);
};

// 纯函数：检查是否为有效的邮箱 (Pure function: check if valid email)
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// 纯函数：检查是否为有效的URL (Pure function: check if valid URL)
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// 纯函数：清理和标准化字符串 (Pure function: sanitize and normalize string)
export const sanitizeString = (str: string): string => {
  return str
    .trim()
    .replace(/\s+/g, ' ') // 合并多个空格
    .replace(/[^\w\s\-_.@]/g, '') // 移除特殊字符
    .substring(0, 1000); // 限制长度
};

// 纯函数：验证端口号 (Pure function: validate port number)
export const isValidPort = (port: number): boolean => {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
};

// 纯函数：验证IP地址 (Pure function: validate IP address)
export const isValidIpAddress = (ip: string): boolean => {
  // IPv4 正则表达式
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  // IPv6 正则表达式（简化版）
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

// 高阶函数：创建批量验证器 (Higher-order function: create batch validator)
export const createBatchValidator = <T>(schema: z.ZodSchema<T>) => {
  return (dataArray: unknown[]): ValidationResult<T[]> => {
    const validator = createValidator(schema);
    const results: T[] = [];
    const errors: string[] = [];

    dataArray.forEach((data, index) => {
      const result = validator(data);
      if (result.success && result.data) {
        results.push(result.data);
      } else {
        errors.push(`Item ${index}: ${result.error}`);
      }
    });

    if (errors.length > 0) {
      return {
        success: false,
        error: errors.join('; ')
      };
    }

    return {
      success: true,
      data: results
    };
  };
};

// 高阶函数：创建条件验证器 (Higher-order function: create conditional validator)
export const createConditionalValidator = <T>(
  schema: z.ZodSchema<T>,
  condition: (data: unknown) => boolean
) => {
  return (data: unknown): ValidationResult<T | null> => {
    if (!condition(data)) {
      return {
        success: true,
        data: null
      };
    }

    const validator = createValidator(schema);
    return validator(data);
  };
};

// 高阶函数：创建异步验证器 (Higher-order function: create async validator)
export const createAsyncValidator = <T>(
  schema: z.ZodSchema<T>,
  asyncCheck?: (data: T) => Promise<boolean>
) => {
  return async (data: unknown): Promise<ValidationResult<T>> => {
    const validator = createValidator(schema);
    const result = validator(data);

    if (!result.success) {
      return result;
    }

    if (asyncCheck && result.data) {
      try {
        const isValid = await asyncCheck(result.data);
        if (!isValid) {
          return {
            success: false,
            error: 'Async validation failed'
          };
        }
      } catch (error) {
        return {
          success: false,
          error: `Async validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }

    return result;
  };
};

// 工具函数：获取验证错误的详细信息 (Utility function: get detailed validation error info)
export const getValidationErrorDetails = (error: z.ZodError): Array<{
  path: string;
  message: string;
  code: string;
  received: unknown;
}> => {
  return error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
    received: (err as any).received
  }));
};

// 工具函数：创建验证摘要 (Utility function: create validation summary)
export const createValidationSummary = (results: ValidationResult<any>[]): {
  total: number;
  successful: number;
  failed: number;
  errors: string[];
} => {
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const errors = results.filter(r => !r.success).map(r => r.error || 'Unknown error');

  return {
    total: results.length,
    successful,
    failed,
    errors
  };
};

export * from './schemas';