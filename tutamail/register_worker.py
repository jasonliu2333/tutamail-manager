import argparse
import json
import sys
from contextlib import contextmanager
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import tuta_register as tuta_mod
from tuta_register import TutaRegister


@contextmanager
def captcha_model_chain(models: list[dict]):
    original_chat = tuta_mod.CaptchaTimeSolver._chat
    original_solve_time = tuta_mod.CaptchaTimeSolver.solve_time
    original_auto = tuta_mod._CONFIG.get("captcha_auto")
    original_api = tuta_mod._CONFIG.get("captcha_api_key")
    original_base = tuta_mod._CONFIG.get("captcha_base_url")
    original_model = tuta_mod._CONFIG.get("captcha_model")
    original_vision_api = tuta_mod._CONFIG.get("vision_api_key")
    original_vision_base = tuta_mod._CONFIG.get("vision_base_url")
    original_vision_model = tuta_mod._CONFIG.get("vision_model")

    rotation_state = {"cursor": 0, "attempt": 0, "current_profile": None}

    def active_profiles() -> list[dict]:
        profiles = [item for item in models if item.get("enabled")]
        if not profiles:
            raise RuntimeError("未配置可用识别模型")
        return profiles

    def profile_name(profile: dict) -> str:
        return (profile.get("name") or profile.get("model_name") or "unnamed").strip()

    def apply_profile(profile: dict) -> None:
        api_key = (profile.get("api_key") or "").strip()
        base_url = (profile.get("base_url") or "").strip()
        model_name = (profile.get("model_name") or "").strip()
        if not api_key or not base_url or not model_name:
            raise RuntimeError(f"{profile_name(profile)} 配置不完整")
        tuta_mod._CONFIG["captcha_api_key"] = api_key
        tuta_mod._CONFIG["captcha_base_url"] = base_url
        tuta_mod._CONFIG["captcha_model"] = model_name
        tuta_mod._CONFIG["vision_api_key"] = api_key
        tuta_mod._CONFIG["vision_base_url"] = base_url
        tuta_mod._CONFIG["vision_model"] = model_name

    @classmethod
    def patched_chat(cls, messages, timeout: int = 60):
        return original_chat(messages, timeout=timeout)

    @classmethod
    def patched_solve_time(cls, image_b64: str, tag: str = ""):
        profiles = active_profiles()
        profile = profiles[rotation_state["cursor"] % len(profiles)]
        rotation_state["cursor"] = (rotation_state["cursor"] + 1) % len(profiles)
        rotation_state["attempt"] += 1
        rotation_state["current_profile"] = profile
        print(
            f"[模型] 第{rotation_state['attempt']}次识别使用 {profile_name(profile)}",
            flush=True,
        )
        apply_profile(profile)
        try:
            return original_solve_time(image_b64, tag=tag)
        finally:
            rotation_state["current_profile"] = None

    tuta_mod.CaptchaTimeSolver._chat = patched_chat
    tuta_mod.CaptchaTimeSolver.solve_time = patched_solve_time
    tuta_mod._CONFIG["captcha_auto"] = True
    if models:
        apply_profile(active_profiles()[0])
    try:
        yield
    finally:
        tuta_mod.CaptchaTimeSolver._chat = original_chat
        tuta_mod.CaptchaTimeSolver.solve_time = original_solve_time
        tuta_mod._CONFIG["captcha_auto"] = original_auto
        tuta_mod._CONFIG["captcha_api_key"] = original_api
        tuta_mod._CONFIG["captcha_base_url"] = original_base
        tuta_mod._CONFIG["captcha_model"] = original_model
        tuta_mod._CONFIG["vision_api_key"] = original_vision_api
        tuta_mod._CONFIG["vision_base_url"] = original_vision_base
        tuta_mod._CONFIG["vision_model"] = original_vision_model


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--proxy", default="")
    parser.add_argument("--tag", default="")
    parser.add_argument("--models-json", default="[]")
    parser.add_argument("--captcha-settings-json", default="{}")
    args = parser.parse_args()

    try:
        models = json.loads(args.models_json or "[]")
        captcha_settings = json.loads(args.captcha_settings_json or "{}")
        if isinstance(captcha_settings, dict):
            tuta_mod._CONFIG.update(captcha_settings)
            tuta_mod.CaptchaTimeSolver._ref_size_cache = None
        reg = TutaRegister(proxy=(args.proxy or None), tag=args.tag or args.email.split("@")[0])
        with captcha_model_chain(models):
            ok = reg.run_register(args.email, args.password)
        payload = {
            "ok": bool(ok),
            "email": args.email,
            "password": args.password,
            "client_id": getattr(reg, "client_id", ""),
            "access_token": getattr(reg, "access_token", ""),
            "user_id": getattr(reg, "user_id", ""),
            "session_ready": bool(getattr(reg, "session_ready", False)),
            "session_error": getattr(reg, "session_error", ""),
            "last_error": getattr(reg, "last_error", ""),
            "account_record": getattr(reg, "account_record", None),
        }
    except Exception as exc:
        payload = {
            "ok": False,
            "email": args.email,
            "password": args.password,
            "client_id": "",
            "access_token": "",
            "user_id": "",
            "session_ready": False,
            "session_error": "",
            "last_error": str(exc),
            "error": str(exc),
            "account_record": None,
        }

    print("__RESULT__" + json.dumps(payload, ensure_ascii=False), flush=True)
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
