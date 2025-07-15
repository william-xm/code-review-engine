import express, { Application, Request, Response } from "express";
import path from "node:path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import helmet from "helmet";
import cors from "cors";
import indexRouter from "./routes/index";
import usersRouter from "./routes/users";
import healthRouter from "./routes/health";
import { errorHandler } from "./middleware/index";
import 'dotenv/config'

const app: Application = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');


// CORS配置需要在其他中间件之前 (CORS configuration should be before other middleware)
app.use(cors());

// 使用日志 (Use logging)
app.use(logger("dev"));

// helmet是安全相关的中间件，可以设置一些安全相关的头，比如xss保护，点击劫持保护，dns预解析保护等
// (Helmet is security-related middleware for XSS protection, clickjacking protection, DNS prefetch protection, etc.)
app.use(helmet({
  crossOriginEmbedderPolicy: false, // 避免CORS冲突 (Avoid CORS conflicts)
}));

// 使用urlencoded (Use URL encoding)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 使用静态文件 (Use static files)
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/health', healthRouter);

// catch 404 and forward to error handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: 'Not Found',
    path: req.path,
    method: req.method
  })
});

// Centralized error handler (must be last)
app.use(errorHandler as unknown as express.ErrorRequestHandler);

// 捕获未捕获的异常 (Catch uncaught exceptions)
process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught Exception:', err.stack);
  // 优雅关闭进程 (Graceful shutdown)
  process.exit(1);
});

// 捕获未处理的 Promise 拒绝 (Catch unhandled promise rejections)
process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // 优雅关闭进程 (Graceful shutdown)
  process.exit(1);
});

// 优雅关闭处理 (Graceful shutdown handling)
const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  // 这里可以添加清理逻辑，如关闭数据库连接等
  // (Add cleanup logic here, such as closing database connections)
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 4399;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;