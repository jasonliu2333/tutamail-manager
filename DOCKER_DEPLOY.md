# Docker 部署说明

本文说明如何基于当前仓库构建 Tutamail 镜像并启动容器。

## 1. 准备环境变量

建议至少设置以下变量：

- `TUTAMAIL_HOST=0.0.0.0`
- `TUTAMAIL_PORT=5100`
- `TUTAMAIL_EXPOSE_PORT=5100`
- `TUTAMAIL_THREADS=8`
- `TUTAMAIL_SECRET_KEY=一段足够长的随机字符串`
- `TUTAMAIL_INITIAL_PASSWORD=首次登录密码`

如果使用 `docker compose`，可以在项目根目录准备 `.env`：

```env
TUTAMAIL_HOST=0.0.0.0
TUTAMAIL_PORT=5100
TUTAMAIL_EXPOSE_PORT=5100
TUTAMAIL_THREADS=8
TUTAMAIL_SECRET_KEY=replace-with-long-random-secret
TUTAMAIL_INITIAL_PASSWORD=replace-with-strong-password
```

## 2. 构建镜像

```powershell
docker compose build
```

如果只想单独构建：

```powershell
docker build -t tutamail:latest .
```

## 3. 启动容器

```powershell
docker compose up -d
```

默认暴露端口：

- `5100:5100`

如果想改宿主机端口，只改：

- `TUTAMAIL_EXPOSE_PORT`

默认持久化目录：

- `./tutamail/data -> /app/tutamail/data`
- `./tutamail/logs -> /app/tutamail/logs`
- `./captchas -> /app/captchas`

## 4. 首次登录

浏览器访问：

- `http://127.0.0.1:5100`

登录密码来源：

- 优先使用 `TUTAMAIL_INITIAL_PASSWORD`
- 如果未设置，程序首次初始化时会生成随机密码并写入 `tutamail/data/initial_admin_password.txt`

## 5. 查看运行状态

```powershell
docker compose ps
docker compose logs -f
```

## 6. 升级

```powershell
docker compose down
docker compose build --no-cache
docker compose up -d
```

数据仍保存在挂载目录中，不会因重建镜像而丢失。

## 7. 常见问题

### 端口冲突

修改 `docker-compose.yml` 中左侧端口，例如：

```yaml
ports:
  - "5110:5100"
```

### 首次密码忘记

如果没有设置 `TUTAMAIL_INITIAL_PASSWORD`，检查：

- `tutamail/data/initial_admin_password.txt`

### 容器能启动但取件失败

优先检查：

- 设置页中的代理配置是否可用
- 容器网络是否允许访问 Tuta 相关接口
- 模型 API、代理 API 是否能从容器内访问
