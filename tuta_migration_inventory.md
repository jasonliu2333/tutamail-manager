# Tuta 项目移植清单与模块说明

本文件用于将当前仓库中的 Tuta 注册 + 邮件管理能力移植到其他开源项目。清单按“必须/可选/参考”分组，并附模块功能说明。

## A. 必须文件（运行注册 + 收信解密）

1. 核心 Python 代码
- `tuta_register.py`：注册流程、登录、邮件拉取与解密的核心实现
- `tuta_crypto_core.py`：Argon2/AES/RSA/Kyber 等基础加解密与密钥生成逻辑
- `get_tuta_mail.py`：交互式收信 + 解密 + HTML 清洗输出纯文本
- `get_tuta_token.py`：获取 client_id / access_token / user_id

2. 配置与依赖
- `config.json`：默认配置（注册、验证码、识别等）
- `requirements.txt`：Python 依赖列表

3. PQ/TutaCrypt 解密链路（必须）
- `pq_decrypt.mjs`：解密 `pubEncBucketKey` 的 Node 脚本
- `liboqs.wasm`：Kyber/ML-KEM WASM 实现
- `package/dist/**`：`@tutao/tutanota-crypto` dist 产物（PQ/加解密算法实现）
- `node_modules/@tutao/tutanota-utils/dist/**`：PQ 解码与工具函数
- `node_modules/@tutao/tutanota-error/dist/**`：错误类型

## B. 可选文件（调试/测试/验证码识别）

1. 验证码识别相关
- `captcha_time.py`：时钟验证码识别核心
- `captcha_hybrid_test.py`：混合识别测试脚本
- `captcha_opencv_test.py`：OpenCV 识别测试脚本
- `captcha_time_test.py`：时钟识别测试脚本
- `captchas/**`：识别样本与缩略图

2. 邮件解密测试
- `test_random_mail.py`：随机账号收信解密验证
- `mail_details_test/**`：测试产物（可删）

## C. 运行产物（不必移植）

- `mail_details/**`：拉取与解密后的邮件内容
- `tuta_accounts.txt`：注册账号简表输出
- `tuta_accounts_full.jsonl`：注册账号完整输出
- `captchas/**`：验证码图片与缩略图

## D. 参考/分析资料（可忽略）

- `app.tuta.com.har` / `har_analysis.txt` / `har_key_apis.txt` / `key_apis.json`：抓包分析资料
- `walkthrough.md` / `implementation_plan.md`：流程说明
- `tuta结构/**` / `tuta响应/**` / `tutu请求/**`：拆分分析产物
- `official_tutanota/**`：官方源码参考（极大体积）
- `package.json` / `package-lock.json` / `tutao-tutanota-crypto-340.260326.1.tgz`：依赖来源（非必须）

## E. 模块功能说明（核心）

- `tuta_register.py`
  - 注册流程：TimeLockCaptcha → Mail Availability → RegistrationCaptcha → System Keys → Create Account → Login
  - 邮件流程：Get User → MailboxGroupRoot → Mailbox → MailSet → MailSetEntry → Mail → MailDetailsBlob
  - 解密路径：
    - 优先 `mail._ownerEncSessionKey` 解密正文
    - 缺失时通过 `bucketKey` → `sessionKey` → 解密正文
    - 若 `pubEncBucketKey`：调用 `pq_decrypt.mjs` 进行 TutaCrypt 解密

- `tuta_crypto_core.py`
  - Argon2 派生 passphrase key
  - AES-CBC + HMAC 加解密
  - RSA/Kyber/X25519 关键字节编码
  - 注册时密钥与 payload 构造

- `get_tuta_mail.py`
  - 交互输入邮箱/密码
  - 登录后拉取并解密邮件
  - HTML 清洗为纯文本输出 `mail_plain.txt`

- `pq_decrypt.mjs`
  - 使用 `liboqs.wasm` 与 `@tutao/tutanota-crypto` 实现 PQ 解密
  - 输入 pubEncBucketKey + 私钥，输出 bucketKey

## F. 移植建议

1. 只迁移 **A 组必须文件**
2. 若仅做收信解密：保留 `tuta_register.py` + `tuta_crypto_core.py` + `get_tuta_mail.py` + PQ 相关文件
3. 若需注册流程：保留 `tuta_register.py` + `tuta_crypto_core.py` + 验证码识别相关脚本（可选）

---
如需生成“最小迁移包清单”或按你们项目结构生成目录树清单，我可以继续补充。
