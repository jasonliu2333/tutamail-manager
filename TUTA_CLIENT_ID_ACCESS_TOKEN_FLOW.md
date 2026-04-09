# Tuta 账号密码换取 `client_id` / `access_token` 方法

本文档说明如何仅通过 `邮箱 + 密码` 获取可复用的 `client_id`、`access_token`，并补充 `user_id`。对应实现可直接参考 `tuta_register.py` 与 `tutamail/app.py`。

## 结论

Tuta 登录链路里：

1. `client_id` 不需要先向服务端申请，实例化 `TutaRegister` 时本地直接生成。
2. 先调用 `get_salt(email)` 获取盐值。
3. 再调用 `create_session(email, password, salt_b64)` 登录。
4. 登录成功后，实例对象上会得到：
   - `reg.client_id`
   - `reg.access_token`
   - `reg.user_id`

其中 `access_token` 后续请求要配合 `user_id` 一起使用。

## 最小流程

```python
from tuta_register import TutaRegister

email = "demo@tutamail.com".strip().lower()
password = "your-password"

reg = TutaRegister(proxy=None, tag="login")

status, salt_data = reg.get_salt(email)
if status != 200:
    raise RuntimeError(f"get_salt failed: {status} {salt_data}")

salt_b64 = salt_data["422"]

status, session_data = reg.create_session(email, password, salt_b64)
if status not in (200, 201):
    raise RuntimeError(f"create_session failed: {status} {session_data}")

status, user_data = reg.get_user()
if status != 200:
    raise RuntimeError(f"get_user failed: {status}")

print("client_id =", reg.client_id)
print("access_token =", reg.access_token)
print("user_id =", reg.user_id)
```

## 关键点

- 邮箱必须先 `strip().lower()`，否则 `get_salt` 可能返回 `400`。
- `client_id` 来自 `TutaRegister.__init__()` 内部的 `_generate_client_id()`。
- `create_session()` 内部会：
  - 用 salt + 密码派生 `passphrase_key`
  - 计算 `auth_verifier`
  - 请求 `/rest/sys/sessionservice`
- 成功后响应中的 `1221` 是 `access_token`，`1223` 是 `user_id`。

## 复用建议

- 建议持久化保存：
  - `email`
  - `password`
  - `client_id`
  - `access_token`
  - `user_id`
- 每次使用前先用 `access_token + user_id` 调 `get_user()` 验证。
- 如果失效，再回退到：
  - `get_salt(email)`
  - `create_session(email, password, salt_b64)`

## 本项目对应位置

- `tuta_register.py`
  - `TutaRegister.__init__`
  - `TutaRegister.get_salt`
  - `TutaRegister.create_session`
  - `TutaRegister.get_user`
- `tutamail/app.py`
  - `fetch_account_inbox()` 中的登录回退逻辑
