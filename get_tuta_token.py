import getpass
import time

from tuta_register import TutaRegister


def main():
    email = input("邮箱: ").strip()
    password = getpass.getpass("密码: ").strip()
    auth_token = input("二次认证码(如无直接回车): ").strip() or None

    # 如需代理：proxy="socks5://ip:port" 或 "http://ip:port"
    reg = TutaRegister(proxy=None, tag="login")

    # 1) 获取 salt
    status, salt_data = reg.get_salt(email)
    if status != 200:
        raise RuntimeError(f"get_salt failed: {status} {salt_data}")
    salt_b64 = salt_data.get("422")

    # 2) 登录拿 session
    status, session_data = reg.create_session(email, password, salt_b64, auth_token=auth_token)
    if status not in (200, 201):
        raise RuntimeError(f"create_session failed: {status} {session_data}")

    print("client_id:", reg.client_id)
    print("access_token:", reg.access_token)
    print("user_id:", reg.user_id)

    # 可选：验证 accessToken 是否可用
    user = None
    for attempt in range(1, 4):
        status, user = reg.get_user()
        if status == 200:
            print("user_ok: true")
            break
        if status in (401, 429, 472):
            time.sleep(2 * attempt)
            continue
        print(f"user_ok: false (status={status})")
        break
    if not user:
        print("user_ok: false (no user data)")


if __name__ == "__main__":
    main()
