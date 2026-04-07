# Tutamail

TutaMail Web 控制台，包含两个核心能力：
- 批量/单次注册 Tuta 邮箱
- 已注册账号的邮件管理与取件查看

## 启动

```powershell
cd tutamail
.\.venv\Scripts\Activate.ps1
python app.py
```

默认监听 `http://127.0.0.1:5100`。
- 现在默认使用 `waitress` 启动，不再走 Flask 开发服务器。
- 首次启动如果 `data/tutamail.db` 不存在：
  - 若设置了 `TUTAMAIL_INITIAL_PASSWORD`，会使用该值作为初始登录密码
  - 否则会在 `tutamail/data/initial_admin_password.txt` 生成随机管理密码

可选环境变量：

```powershell
$env:TUTAMAIL_HOST = "127.0.0.1"
$env:TUTAMAIL_PORT = "5100"
$env:TUTAMAIL_THREADS = "8"
$env:TUTAMAIL_SECRET_KEY = "replace-with-long-random-secret"
$env:TUTAMAIL_INITIAL_PASSWORD = "replace-with-strong-password"
python app.py
```

首次部署前请先安装额外运行依赖：

```powershell
pip install -r requirements.txt
```

## Docker

项目根目录已提供：
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`

构建与运行：

```powershell
docker compose build
docker compose up -d
```

容器内同样使用 `waitress` 提供服务，默认端口 `5100`。

## 页面说明

- `/register`：注册中心。参考 `codex-manager-master` 的控制台风格，支持批量注册、任务轮询、实时日志、进度条、最近入库账号。
- `/mail`：邮件管理。参考 `outlookEmail-main` 的多栏结构，支持分组、账号管理、收件箱分页拉取、邮件详情查看。
- `/settings`：代理配置、识别模型 fallback 链、登录密码和对外 API Key 配置。

## 目录

- `app.py`: Flask Web 应用入口
- `templates/`: 页面模板
- `static/`: 前端脚本与样式
- `data/`: SQLite 数据库、缓存、运行产物
- `logs/`: Web 应用日志

## 说明

- 项目复用了仓库根目录的 `tuta_register.py`、`tuta_crypto_core.py`、`pq_decrypt.mjs`、`liboqs.wasm`、`package/`。
- 注册任务支持固定代理、动态代理、模型 fallback 链。
- 邮件管理当前以 Tuta 收件箱为主，支持分页取最近邮件与正文查看。
- 注册成功后会自动写入 `data/tutamail.db` 中的 `accounts` 表。
- 不要提交 `tutamail/data/`、`tutamail/logs/`、`captchas/`、`config.json` 等运行产物和敏感配置。
