import express, { Router } from 'express';
import { healthCheck } from '../review-engine';

const router: Router = express.Router();

// 健康检查端点 (Health check endpoint)
router.get('/', async (req, res) => {
  const startTime = Date.now();

  try {
    // 检查基本服务状态 (Check basic service status)
    const basicChecks = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    };

    // 检查环境变量 (Check environment variables)
    const envChecks = {
      gitlab: {
        api_url: !!process.env.GITLAB_API_URL,
        api_host: !!process.env.GITLAB_API_HOST,
        token: !!process.env.GITLAB_TOKEN,
      },
      ai: {
        siliconflow_token: !!process.env.SILICONFLOW_TOKEN,
        siliconflow_base_url: !!process.env.SILICONFLOW_BASE_URL,
      },
    };

    // 检查AI服务健康状态 (Check AI service health)
    const aiHealthy = await healthCheck();

    const responseTime = Date.now() - startTime;

    const healthStatus = {
      status: 'healthy',
      ...basicChecks,
      checks: {
        environment: envChecks,
        ai_service: aiHealthy,
        response_time: `${responseTime}ms`,
      },
    };

    // 如果AI服务不健康，返回degraded状态 (Return degraded status if AI service is unhealthy)
    if (!aiHealthy) {
      healthStatus.status = 'degraded';
    }

    res.status(200).json(healthStatus);
  } catch (error) {
    const responseTime = Date.now() - startTime;

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      response_time: `${responseTime}ms`,
    });
  }
});

// 简单的存活检查端点 (Simple liveness check endpoint)
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// 就绪检查端点 (Readiness check endpoint)
router.get('/ready', async (req, res) => {
  try {
    // 检查关键依赖是否就绪 (Check if critical dependencies are ready)
    const isReady = !!(
      process.env.GITLAB_API_URL &&
      process.env.GITLAB_TOKEN &&
      process.env.SILICONFLOW_TOKEN &&
      process.env.SILICONFLOW_BASE_URL
    );

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        message: 'Missing required environment variables',
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;