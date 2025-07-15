# 多阶段构建 - 基础镜像 (Multi-stage build - Base image)
FROM node:24-alpine3.22 AS base

# 安装pnpm (Install pnpm)
RUN npm install -g pnpm@9.12.2

# 依赖安装阶段 (Dependencies installation stage)
FROM base AS deps

WORKDIR /app

# 复制依赖文件 (Copy dependency files)
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖 (Install all dependencies)
RUN pnpm install --frozen-lockfile

# 构建阶段 (Build stage)
FROM base AS builder

WORKDIR /app

# 从依赖阶段复制node_modules (Copy node_modules from deps stage)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./

# 复制源代码 (Copy source code)
COPY src ./src
COPY tsconfig.json ./

# 设置构建环境变量 (Set build environment variables)
ENV NODE_OPTIONS="--max-old-space-size=4096"

# 构建应用 (Build application)
RUN pnpm build

# 生产运行阶段 (Production runtime stage)
FROM base AS runtime

WORKDIR /app

# 创建非root用户 (Create non-root user)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S express -u 1001

# 从依赖阶段复制生产依赖 (Copy production dependencies)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./

# 从构建阶段复制构建产物 (Copy build artifacts from builder stage)
COPY --from=builder /app/dist ./dist

# 复制PM2配置文件 (Copy PM2 configuration files)
COPY pm2.production.json ./

# 复制视图文件到正确位置 (Copy view files to correct location)
COPY src/views ./dist/views

# 创建必要目录 (Create necessary directories)
RUN mkdir -p /app/logs && \
    chown -R express:nodejs /app && \
    chmod -R g=u /app

# 切换到非root用户 (Switch to non-root user)
USER express

# 暴露端口 (Expose port)
EXPOSE 4399

# 健康检查 (Health check)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4399/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# 启动应用 (Start application using PM2)
CMD ["npx", "pm2-runtime", "start", "pm2.production.json"]