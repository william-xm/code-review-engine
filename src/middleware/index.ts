import { Request, Response, NextFunction } from 'express';
import webhookListener from '../webhook';

// 高阶函数用于创建中间件 (Higher-order function for creating middleware)
const createMiddleware = (handler: (req: Request, res: Response, next: NextFunction) => void | Promise<void>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// 通用错误处理中间件 (Generic error handling middleware)
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // 开发环境返回详细错误信息 (Return detailed error info in development)
  const isDevelopment = process.env.NODE_ENV === 'development';

  const errorResponse = {
    message: err.message || 'Internal Server Error',
    status: err.status || 500,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    ...(isDevelopment && { stack: err.stack })
  };

  // 特定错误类型处理 (Handle specific error types)
  if (err.code === 'EACCES') {
    return res.status(401).json({
      message: 'Access denied. Please check your permissions.',
      code: 'EACCES'
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: err.errors
    });
  }

  return res.status(errorResponse.status).json(errorResponse);
};

// 请求日志中间件 (Request logging middleware)
export const requestLogger = createMiddleware((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // 记录响应时间 (Log response time)
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// Webhook 处理中间件 (Webhook processing middleware)
export const webhookProcessor = createMiddleware(async (req: Request, res: Response, next: NextFunction) => {
  if (req.body && Object.keys(req.body).length > 0) {
    try {
      await webhookListener(req.body);
    } catch (error) {
      console.error('Webhook processing failed:', error);
      // 不阻止请求继续处理 (Don't block request processing)
    }
  }
  next();
});

// 请求验证中间件 (Request validation middleware)
export const validateRequest = createMiddleware((req: Request, res: Response, next: NextFunction) => {
  // 添加基本的请求验证 (Add basic request validation)
  if (req.method === 'POST' && !req.body) {
    throw new Error('Request body is required for POST requests');
  }

  next();
});

// 速率限制中间件 (Rate limiting middleware)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

export const rateLimiter = createMiddleware((req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip || 'unknown';
  const now = Date.now();

  const clientData = requestCounts.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    requestCounts.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    next();
    return;
  }

  if (clientData.count >= RATE_LIMIT_MAX) {
    res.status(429).json({
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
    return;
  }

  clientData.count++;
  next();
});

// 组合中间件函数 (Middleware composition function)
export const composeMiddleware = (...middlewares: any[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;

    const dispatch = (i: number): void => {
      if (i <= index) return;
      index = i;

      const middleware = middlewares[i];
      if (!middleware) {
        next();
        return;
      }

      try {
        middleware(req, res, () => dispatch(i + 1));
      } catch (error) {
        next(error);
      }
    };

    dispatch(0);
  };
};

// 导出常用中间件组合 (Export common middleware combinations)
export const commonMiddleware = composeMiddleware(
  requestLogger,
  rateLimiter,
  validateRequest
);

// 兼容性导出 (Compatibility exports)
export const requestUrl = requestLogger;
export const requestBody = webhookProcessor;