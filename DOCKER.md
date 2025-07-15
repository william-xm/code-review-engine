# Docker 部署指南

## 🚀 快速开始

### 1. 环境变量配置

创建 `.env` 文件（参考 `.env.example`）：

```bash
# 应用配置
NODE_ENV=production
PORT=4399
IP_ADDRESS=0.0.0.0

# GitLab配置（必须）
GITLAB_API_URL=https://your-gitlab.com
GITLAB_API_HOST=your-gitlab.com
GITLAB_TOKEN=your_gitlab_token_here

# AI服务配置（必须）
SILICONFLOW_TOKEN=your_siliconflow_token_here
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
```

### 2. 使用Docker运行

#### 方式一：Docker命令（推荐）

```bash
# 构建镜像
npm run docker:build

# 运行容器
npm run docker:run

# 查看日志
npm run docker:logs

# 停止容器
npm run docker:stop

# 删除容器
npm run docker:remove
```

#### 方式二：Docker Compose

```bash
# 启动服务
npm run docker:compose:up

# 查看日志
npm run docker:compose:logs

# 停止服务
npm run docker:compose:down
```

### 3. 健康检查

```bash
# 检查服务状态
curl http://localhost:4399/health

# 或使用npm脚本
npm run health-check
```

## 📋 可用的Docker命令

| 命令 | 说明 |
|------|------|
| `npm run docker:build` | 构建生产镜像 |
| `npm run docker:run` | 运行容器（后台） |
| `npm run docker:stop` | 停止容器 |
| `npm run docker:remove` | 删除容器 |
| `npm run docker:logs` | 查看容器日志 |
| `npm run docker:compose:up` | 使用docker-compose启动 |
| `npm run docker:compose:down` | 使用docker-compose停止 |
| `npm run docker:compose:logs` | 查看compose日志 |
| `npm run docker:clean` | 清理Docker系统 |

## 🔧 故障排除

### 常见问题

1. **容器无法启动**
   ```bash
   # 检查环境变量
   cat .env

   # 检查镜像是否构建成功
   docker images | grep express-demo
   ```

2. **健康检查失败**
   ```bash
   # 检查容器状态
   docker ps -a

   # 查看详细日志
   docker logs express-demo-container
   ```

3. **端口冲突**
   ```bash
   # 检查端口占用
   lsof -i :4399

   # 修改.env中的PORT配置
   ```

### 调试模式

如需调试，可以直接运行容器并进入shell：

```bash
docker run -it --rm --env-file .env express-demo sh
```

## 📊 性能监控

容器包含以下健康检查端点：

- `/health` - 完整健康检查
- `/health/live` - 存活检查
- `/health/ready` - 就绪检查

## 🔒 安全配置

容器已配置：
- 非root用户运行
- 最小权限原则
- 资源限制
- 健康检查