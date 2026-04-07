# Tutamail Repository

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
