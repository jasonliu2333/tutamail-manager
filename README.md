# Tutamail Manager

Tutamail 是一个面向 Tuta/Tutamail 的本地 Web 控制台，包含：

- 注册中心：批量注册、代理切换、验证码模型 fallback、实时日志
- 邮件管理：分组、导入导出、批量取件、邮件缓存、详情查看

## 主要目录

- `tutamail/`: Flask Web 应用
- `tuta_register.py`: 核心注册链路
- `tuta_crypto_core.py`: 加密与解密辅助
- `package/`: `@tutao/tutanota-crypto` 构建产物
- `Dockerfile` / `docker-compose.yml`: 容器化部署

## 本地启动

```powershell
python -m venv tutamail\.venv
tutamail\.venv\Scripts\python.exe -m pip install -r tutamail\requirements.txt
$env:TUTAMAIL_INITIAL_PASSWORD = "replace-with-strong-password"
tutamail\.venv\Scripts\python.exe tutamail\app.py
```

默认地址：`http://127.0.0.1:5100`

## 安全说明

- 不要提交 `config.json`、`tutamail/data/`、`tutamail/logs/`、`captchas/`
- 首次启动建议显式设置：
  - `TUTAMAIL_SECRET_KEY`
  - `TUTAMAIL_INITIAL_PASSWORD`
- 可参考 `config.example.json` 生成本地私有配置

## Docker

```powershell
docker compose build
docker compose up -d
```

默认对外暴露端口见 `docker-compose.yml`，首次启动建议通过环境变量设置：

- `TUTAMAIL_SECRET_KEY`
- `TUTAMAIL_INITIAL_PASSWORD`

## GitHub Actions 镜像

仓库包含 GitHub Actions 工作流：

- 文件：`.github/workflows/docker-image.yml`
- 触发：
  - push 到 `main`
  - push `v*` tag
  - PR 到 `main` 时只做 build 检查，不推送
- 镜像仓库：
  - `ghcr.io/jasonliu2333/tutamail-manager`

推送到 `main` 后，会自动发布类似这些 tag：

- `latest`
- `main`
- `sha-<commit>`
- `v*` tag 对应版本号

## Docker Compose 运行说明

### 方式 1：直接使用 GitHub Actions 产出的镜像

先登录 GHCR：

```powershell
echo <GITHUB_TOKEN> | docker login ghcr.io -u <GitHub 用户名> --password-stdin
```

然后把 `docker-compose.yml` 里的服务改成直接拉取镜像，例如：

```yaml
services:
  tutamail:
    image: ghcr.io/jasonliu2333/tutamail-manager:latest
    container_name: tutamail-manager
    ports:
      - "${TUTAMAIL_EXPOSE_PORT:-5100}:${TUTAMAIL_PORT:-5100}"
    environment:
      TUTAMAIL_HOST: "${TUTAMAIL_HOST:-0.0.0.0}"
      TUTAMAIL_PORT: "${TUTAMAIL_PORT:-5100}"
      TUTAMAIL_THREADS: "${TUTAMAIL_THREADS:-8}"
      TUTAMAIL_SECRET_KEY: "${TUTAMAIL_SECRET_KEY}"
      TUTAMAIL_INITIAL_PASSWORD: "${TUTAMAIL_INITIAL_PASSWORD}"
    volumes:
      - ./tutamail/data:/app/tutamail/data
      - ./tutamail/logs:/app/tutamail/logs
      - ./captchas:/app/captchas
    restart: unless-stopped
```

启动：

```powershell
docker compose pull
docker compose up -d
```

### 方式 2：本地构建后运行

创建 `.env`：

```dotenv
TUTAMAIL_EXPOSE_PORT=5100
TUTAMAIL_PORT=5100
TUTAMAIL_THREADS=8
TUTAMAIL_SECRET_KEY=replace-with-long-random-secret
TUTAMAIL_INITIAL_PASSWORD=replace-with-strong-password
```

然后运行：

```powershell
docker compose build
docker compose up -d
```

查看状态：

```powershell
docker compose ps
docker compose logs -f tutamail
```

默认访问地址：

- `http://127.0.0.1:5100`

数据目录说明：

- `./tutamail/data`：本地数据库与运行数据
- `./tutamail/logs`：应用日志
- `./captchas`：验证码与缩略图

停止与清理：

```powershell
docker compose down
```

如需连同匿名卷一起清理：

```powershell
docker compose down -v
```
