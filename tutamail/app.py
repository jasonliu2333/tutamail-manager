import base64
import functools
import html
import json
import os
import re
import secrets
import shutil
import sqlite3
import struct
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import bcrypt
import bleach
from curl_cffi import requests as curl_requests
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from flask import Flask, Response, g, jsonify, redirect, render_template, request, session, url_for
from urllib.parse import quote, urlparse

ROOT_DIR = Path(__file__).resolve().parents[1]
APP_DIR = Path(__file__).resolve().parent
DATA_DIR = APP_DIR / "data"
LOG_DIR = APP_DIR / "logs"
MAIL_CACHE_DIR = DATA_DIR / "mail_cache"
DB_PATH = DATA_DIR / "tutamail.db"
APP_LOG_PATH = LOG_DIR / "app.log"

DATA_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)
MAIL_CACHE_DIR.mkdir(parents=True, exist_ok=True)

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import tuta_register as tuta_mod
from tuta_register import CONFIG_DEFAULTS as TUTA_CONFIG_DEFAULTS, TUTA_FREE_DOMAINS, TutaRegister

ACCOUNT_FETCH_STATUS_META: dict[str, dict[str, str]] = {
    "unknown": {"label": "待检查", "tone": "muted"},
    "ok": {"label": "正常", "tone": "success"},
    "account_exists_but_login_revoked": {"label": "账号存在但已禁登", "tone": "danger"},
    "bad_request": {"label": "错误请求", "tone": "warning"},
    "not_authenticated": {"label": "未认证", "tone": "danger"},
    "not_authorized": {"label": "未授权", "tone": "danger"},
    "not_found": {"label": "不存在", "tone": "danger"},
    "method_not_allowed": {"label": "方法不允许", "tone": "warning"},
    "request_timeout": {"label": "请求超时", "tone": "warning"},
    "precondition_failed": {"label": "前置条件失败", "tone": "warning"},
    "payload_too_large": {"label": "请求体过大", "tone": "warning"},
    "locked": {"label": "资源锁定", "tone": "warning"},
    "too_many_requests": {"label": "请求过多", "tone": "warning"},
    "session_expired": {"label": "会话过期", "tone": "warning"},
    "access_deactivated": {"label": "访问已停用", "tone": "danger"},
    "access_expired": {"label": "访问已过期", "tone": "danger"},
    "access_blocked": {"label": "访问已封锁", "tone": "danger"},
    "invalid_data": {"label": "数据无效", "tone": "warning"},
    "invalid_software_version": {"label": "版本无效", "tone": "warning"},
    "limit_reached": {"label": "达到限制", "tone": "warning"},
    "network_error": {"label": "网络异常", "tone": "warning"},
    "internal_server_error": {"label": "服务端异常", "tone": "warning"},
    "bad_gateway": {"label": "网关错误", "tone": "warning"},
    "service_unavailable": {"label": "服务不可用", "tone": "warning"},
    "insufficient_storage": {"label": "存储不足", "tone": "warning"},
    "resource_error": {"label": "资源错误", "tone": "warning"},
}

LEGACY_FETCH_STATUS_MAP = {
    "auth_failed": "not_authenticated",
    "server_error": "internal_server_error",
}

OFFICIAL_ERROR_TO_FETCH_STATUS = {
    "BadRequestError": "bad_request",
    "NotAuthenticatedError": "not_authenticated",
    "NotAuthorizedError": "not_authorized",
    "NotFoundError": "not_found",
    "MethodNotAllowedError": "method_not_allowed",
    "RequestTimeoutError": "request_timeout",
    "PreconditionFailedError": "precondition_failed",
    "PayloadTooLargeError": "payload_too_large",
    "LockedError": "locked",
    "TooManyRequestsError": "too_many_requests",
    "SessionExpiredError": "session_expired",
    "AccessDeactivatedError": "access_deactivated",
    "AccessExpiredError": "access_expired",
    "AccessBlockedError": "access_blocked",
    "InvalidDataError": "invalid_data",
    "InvalidSoftwareVersionError": "invalid_software_version",
    "LimitReachedError": "limit_reached",
    "InternalServerError": "internal_server_error",
    "BadGatewayError": "bad_gateway",
    "ServiceUnavailableError": "service_unavailable",
    "InsufficientStorageError": "insufficient_storage",
    "ConnectionError": "network_error",
    "ResourceError": "resource_error",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def log_app(message: str) -> None:
    with APP_LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(f"[{utc_now()}] {message}\n")


def ensure_secret() -> str:
    env_secret = os.getenv("TUTAMAIL_SECRET_KEY", "").strip()
    if env_secret:
        return env_secret
    secret_path = DATA_DIR / "secret.key"
    if secret_path.exists():
        return secret_path.read_text(encoding="utf-8").strip()
    secret = secrets.token_urlsafe(48)
    secret_path.write_text(secret, encoding="utf-8")
    return secret


SECRET_VALUE = ensure_secret()


def derive_fernet_key() -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"tutamail-fernet-v1",
        iterations=100_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(SECRET_VALUE.encode("utf-8")))


FERNET = Fernet(derive_fernet_key())


def encrypt_value(value: str) -> str:
    return FERNET.encrypt((value or "").encode("utf-8")).decode("utf-8")


def decrypt_value(value: str | None) -> str:
    if not value:
        return ""
    return FERNET.decrypt(value.encode("utf-8")).decode("utf-8")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def normalize_account_fetch_status(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    normalized = LEGACY_FETCH_STATUS_MAP.get(normalized, normalized)
    if normalized in ACCOUNT_FETCH_STATUS_META:
        return normalized
    return "unknown"


def account_fetch_status_label(value: str | None) -> str:
    normalized = normalize_account_fetch_status(value)
    return ACCOUNT_FETCH_STATUS_META[normalized]["label"]


def account_fetch_status_tone(value: str | None) -> str:
    normalized = normalize_account_fetch_status(value)
    return ACCOUNT_FETCH_STATUS_META[normalized]["tone"]


class AccountFetchError(RuntimeError):
    def __init__(
        self,
        message: str,
        fetch_status: str = "unknown",
        *,
        http_status: int | None = None,
        official_error: str = "",
        step: str = "",
        response_body: Any = None,
        can_retry_with_password: bool = False,
    ) -> None:
        super().__init__(message)
        self.fetch_status = normalize_account_fetch_status(fetch_status)
        self.http_status = int(http_status) if http_status is not None else None
        self.official_error = (official_error or "").strip()
        self.step = (step or "").strip()
        self.response_body = response_body
        self.can_retry_with_password = bool(can_retry_with_password)


def strip_html(value: str) -> str:
    if not value:
        return ""
    text = value.replace("\r\n", "\n")
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p\s*>", "\n", text)
    text = re.sub(r"(?i)<p\s*>", "", text)
    text = re.sub(r"(?i)<li\s*>", "- ", text)
    text = re.sub(r"(?i)</li\s*>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def sanitize_mail_html(value: str) -> str:
    if not value:
        return ""
    return bleach.clean(
        value,
        tags=["a", "b", "blockquote", "br", "code", "div", "em", "hr", "i", "li", "ol", "p", "pre", "span", "strong", "u", "ul"],
        attributes={"a": ["href", "title", "target", "rel"]},
        protocols=["http", "https", "mailto"],
        strip=True,
    )


def safe_slug(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", value)


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def format_mail_datetime(value: str | None) -> str:
    dt = parse_iso_datetime(value)
    if not dt:
        return str(value or "")
    return dt.astimezone().strftime("%Y-%m-%d %H:%M:%S")


def extract_contact_email(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("95") or value.get("address") or value.get("email") or "").strip()
    if isinstance(value, list):
        for item in value:
            email_addr = extract_contact_email(item)
            if email_addr:
                return email_addr
    return ""


app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = SECRET_VALUE
app.config["JSON_AS_ASCII"] = False
app.config["PERMANENT_SESSION_LIFETIME"] = 60 * 60 * 24 * 7
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_exc: Exception | None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def db_execute(sql: str, params: tuple = ()) -> sqlite3.Cursor:
    cur = get_db().execute(sql, params)
    get_db().commit()
    return cur


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT DEFAULT '',
            color TEXT DEFAULT '#3f6fd9',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS proxy_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            mode TEXT NOT NULL DEFAULT 'none',
            proxy_url TEXT,
            dynamic_proxy_url TEXT,
            dynamic_proxy_protocol TEXT DEFAULT 'socks5',
            enabled INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS model_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            api_key_enc TEXT NOT NULL,
            base_url TEXT NOT NULL,
            model_name TEXT NOT NULL,
            priority INTEGER DEFAULT 10,
            enabled INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_enc TEXT NOT NULL,
            client_id TEXT,
            access_token_enc TEXT,
            user_id TEXT,
            group_id INTEGER DEFAULT 1,
            remark TEXT,
            status TEXT DEFAULT 'active',
            fetch_status TEXT DEFAULT 'unknown',
            last_http_status INTEGER,
            last_official_error TEXT,
            last_fetch_step TEXT,
            session_refreshed_at TEXT,
            last_check_at TEXT,
            last_error TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS account_meta (
            account_id INTEGER PRIMARY KEY,
            record_enc TEXT NOT NULL DEFAULT '',
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    """)
    cur.execute("PRAGMA table_info(accounts)")
    account_columns = [row[1] for row in cur.fetchall()]
    if "access_token_enc" not in account_columns:
        cur.execute("ALTER TABLE accounts ADD COLUMN access_token_enc TEXT")
    if "user_id" not in account_columns:
        cur.execute("ALTER TABLE accounts ADD COLUMN user_id TEXT")
    if "fetch_status" not in account_columns:
        cur.execute("ALTER TABLE accounts ADD COLUMN fetch_status TEXT DEFAULT 'unknown'")
    if "last_http_status" not in account_columns:
        cur.execute("ALTER TABLE accounts ADD COLUMN last_http_status INTEGER")
    if "last_official_error" not in account_columns:
        cur.execute("ALTER TABLE accounts ADD COLUMN last_official_error TEXT")
    if "last_fetch_step" not in account_columns:
        cur.execute("ALTER TABLE accounts ADD COLUMN last_fetch_step TEXT")
    if "session_refreshed_at" not in account_columns:
        cur.execute("ALTER TABLE accounts ADD COLUMN session_refreshed_at TEXT")
    cur.execute("PRAGMA table_info(groups)")
    group_columns = [row[1] for row in cur.fetchall()]
    if "description" not in group_columns:
        cur.execute("ALTER TABLE groups ADD COLUMN description TEXT DEFAULT ''")
    cur.execute("INSERT OR IGNORE INTO groups (id, name, color) VALUES (1, '默认分组', '#6f7a8f')")
    cur.execute("INSERT OR IGNORE INTO proxy_profiles (id, name, mode, enabled) VALUES (1, '不使用代理', 'none', 1)")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_register_domain', ?)", (TUTA_FREE_DOMAINS[0],))
    cur.execute("SELECT value FROM settings WHERE key = 'login_password_hash'")
    if not cur.fetchone():
        initial_password = (os.getenv("TUTAMAIL_INITIAL_PASSWORD") or "").strip()
        if not initial_password:
            initial_password = secrets.token_urlsafe(12)
            password_file = DATA_DIR / "initial_admin_password.txt"
            password_file.write_text(
                "首次启动随机生成的管理密码\n"
                f"生成时间: {utc_now()}\n"
                f"password={initial_password}\n",
                encoding="utf-8",
            )
        cur.execute("INSERT INTO settings (key, value) VALUES ('login_password_hash', ?)", (hash_password(initial_password),))
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('external_api_key', '')")
    conn.commit()
    conn.close()


def get_setting(key: str, default: str = "") -> str:
    cur = get_db().execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cur.fetchone()
    return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    db_execute(
        """
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        """,
        (key, value),
    )


CAPTCHA_SETTINGS_KEY = "captcha_settings_json"
CAPTCHA_SETTING_FIELDS = [
    "captcha_max_attempts",
    "vision_resize_enabled",
    "vision_resize_max",
    "vision_resize_width",
    "vision_resize_height",
    "vision_resize_ref",
    "vision_crop_mode",
    "vision_save_thumbs",
    "vision_thumb_dir",
    "vision_day_night_system_prompt",
    "vision_day_night_user_prompt",
    "vision_time_system_prompt",
    "vision_time_user_prompt",
    "vision_blur_kernel",
    "vision_canny_threshold1",
    "vision_canny_threshold2",
    "vision_dilate_iterations",
    "vision_erode_iterations",
    "vision_hough_dp",
    "vision_hough_min_dist",
    "vision_hough_param1",
    "vision_hough_param2",
    "vision_hough_min_radius_ratio",
    "vision_hough_max_radius_ratio",
    "vision_hough_lines_threshold",
    "vision_min_line_length_ratio",
    "vision_max_line_gap",
    "vision_crop_margin_pair_ratio",
    "vision_crop_margin_full_ratio",
]
CAPTCHA_BOOL_FIELDS = {"vision_resize_enabled", "vision_save_thumbs"}
CAPTCHA_INT_FIELDS = {
    "captcha_max_attempts",
    "vision_resize_max",
    "vision_resize_width",
    "vision_resize_height",
    "vision_blur_kernel",
    "vision_dilate_iterations",
    "vision_erode_iterations",
    "vision_hough_min_dist",
    "vision_hough_lines_threshold",
    "vision_max_line_gap",
}
CAPTCHA_FLOAT_FIELDS = {
    "vision_canny_threshold1",
    "vision_canny_threshold2",
    "vision_hough_dp",
    "vision_hough_param1",
    "vision_hough_param2",
    "vision_hough_min_radius_ratio",
    "vision_hough_max_radius_ratio",
    "vision_min_line_length_ratio",
    "vision_crop_margin_pair_ratio",
    "vision_crop_margin_full_ratio",
}


def captcha_setting_defaults() -> dict[str, Any]:
    return {key: tuta_mod._CONFIG.get(key, TUTA_CONFIG_DEFAULTS[key]) for key in CAPTCHA_SETTING_FIELDS}


def captcha_setting_static_defaults() -> dict[str, Any]:
    return {key: TUTA_CONFIG_DEFAULTS[key] for key in CAPTCHA_SETTING_FIELDS}


def _coerce_captcha_setting(key: str, value: Any, default: Any) -> Any:
    if key in CAPTCHA_BOOL_FIELDS:
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in {"1", "true", "yes", "on"}
    if key in CAPTCHA_INT_FIELDS:
        try:
            return int(value)
        except Exception:
            return int(default)
    if key in CAPTCHA_FLOAT_FIELDS:
        try:
            return float(value)
        except Exception:
            return float(default)
    return str(value if value is not None else default)


def get_captcha_settings() -> dict[str, Any]:
    defaults = captcha_setting_defaults()
    raw = get_setting(CAPTCHA_SETTINGS_KEY, "")
    if not raw:
        return defaults
    try:
        payload = json.loads(raw)
    except Exception:
        return defaults
    if not isinstance(payload, dict):
        return defaults
    static_defaults = captcha_setting_static_defaults()
    if payload == static_defaults and defaults != static_defaults:
        # 兼容早期版本：当“恢复默认”写入的是代码静态默认值时，
        # 自动迁回当前 config.json / 运行时加载出的稳定配置。
        set_setting(CAPTCHA_SETTINGS_KEY, json.dumps(defaults, ensure_ascii=False))
        return defaults
    settings = dict(defaults)
    for key in CAPTCHA_SETTING_FIELDS:
        if key in payload:
            settings[key] = _coerce_captcha_setting(key, payload[key], defaults[key])
    return settings


def save_captcha_settings(settings: dict[str, Any]) -> dict[str, Any]:
    defaults = captcha_setting_defaults()
    normalized = {}
    for key in CAPTCHA_SETTING_FIELDS:
        normalized[key] = _coerce_captcha_setting(key, settings.get(key, defaults[key]), defaults[key])
    set_setting(CAPTCHA_SETTINGS_KEY, json.dumps(normalized, ensure_ascii=False))
    return normalized


def reset_captcha_settings() -> dict[str, Any]:
    defaults = captcha_setting_defaults()
    set_setting(CAPTCHA_SETTINGS_KEY, json.dumps(defaults, ensure_ascii=False))
    return defaults


def login_required(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if not session.get("logged_in"):
            if request.path.startswith("/api/"):
                return jsonify({"success": False, "error": "未登录"}), 401
            return redirect(url_for("login_page"))
        return func(*args, **kwargs)
    return wrapper


def external_api_key_required(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        expected = get_setting("external_api_key", "").strip()
        if not expected:
            return jsonify({"success": False, "error": "未配置对外 API Key"}), 403
        provided = request.headers.get("X-API-Key", "").strip() or request.args.get("api_key", "").strip()
        if not provided:
            return jsonify({"success": False, "error": "缺少 API Key"}), 401
        if provided != expected:
            return jsonify({"success": False, "error": "API Key 无效"}), 401
        return func(*args, **kwargs)
    return wrapper


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row else None


def load_groups() -> list[dict[str, Any]]:
    cur = get_db().execute("""
        SELECT g.*, COUNT(a.id) AS account_count
        FROM groups g
        LEFT JOIN accounts a ON a.group_id = g.id
        GROUP BY g.id
        ORDER BY g.id ASC
    """)
    return [dict(row) for row in cur.fetchall()]


def load_group(group_id: int) -> dict[str, Any] | None:
    cur = get_db().execute("SELECT * FROM groups WHERE id = ?", (group_id,))
    return row_to_dict(cur.fetchone())


def load_proxy_profiles() -> list[dict[str, Any]]:
    cur = get_db().execute("SELECT * FROM proxy_profiles ORDER BY id ASC")
    return [dict(row) for row in cur.fetchall()]


def load_proxy_profile(profile_id: int | None) -> dict[str, Any] | None:
    if not profile_id:
        return None
    cur = get_db().execute("SELECT * FROM proxy_profiles WHERE id = ?", (profile_id,))
    return row_to_dict(cur.fetchone())


def load_model_profiles(enabled_only: bool = False) -> list[dict[str, Any]]:
    sql = "SELECT * FROM model_profiles"
    if enabled_only:
        sql += " WHERE enabled = 1"
    sql += " ORDER BY enabled DESC, priority ASC, id ASC"
    cur = get_db().execute(sql)
    results = []
    for row in cur.fetchall():
        item = dict(row)
        item["api_key"] = decrypt_value(item.pop("api_key_enc"))
        results.append(item)
    return results


def load_accounts(group_id: int | None = None) -> list[dict[str, Any]]:
    sql = """
        SELECT a.*, g.name AS group_name, g.color AS group_color
        FROM accounts a
        LEFT JOIN groups g ON g.id = a.group_id
    """
    params: list[Any] = []
    if group_id:
        sql += " WHERE a.group_id = ?"
        params.append(group_id)
    sql += " ORDER BY a.id DESC"
    cur = get_db().execute(sql, tuple(params))
    results = []
    for row in cur.fetchall():
        item = dict(row)
        item["password"] = decrypt_value(item["password_enc"])
        item.pop("password_enc", None)
        item["access_token"] = decrypt_value(item.get("access_token_enc"))
        item.pop("access_token_enc", None)
        item["fetch_status"] = normalize_account_fetch_status(item.get("fetch_status"))
        item["fetch_status_label"] = account_fetch_status_label(item["fetch_status"])
        item["fetch_status_tone"] = account_fetch_status_tone(item["fetch_status"])
        results.append(item)
    return results


def load_accounts_by_ids(account_ids: list[int]) -> list[dict[str, Any]]:
    valid_ids = [int(item) for item in account_ids if int(item) > 0]
    if not valid_ids:
        return []
    records = {int(item["id"]): item for item in load_accounts()}
    return [records[item_id] for item_id in valid_ids if item_id in records]


def load_account_meta(account_id: int) -> dict[str, Any] | None:
    cur = get_db().execute("SELECT record_enc FROM account_meta WHERE account_id = ?", (int(account_id),))
    row = cur.fetchone()
    if not row:
        return None
    raw = decrypt_value(row["record_enc"])
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def save_account_meta(account_id: int, record: dict[str, Any] | None) -> None:
    if not record:
        return
    payload = json.dumps(record, ensure_ascii=False)
    db_execute("""
        INSERT INTO account_meta (account_id, record_enc, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
            record_enc = excluded.record_enc,
            updated_at = excluded.updated_at
    """, (int(account_id), encrypt_value(payload), utc_now()))


def sync_account_meta_core(account_id: int, account_data: dict[str, Any]) -> None:
    record = load_account_meta(account_id) or {}
    record["email"] = (account_data.get("email") or "").strip().lower()
    record["password"] = account_data.get("password") or ""
    record["mail_domain"] = record["email"].split("@")[-1] if "@" in record["email"] else None
    record["client_id"] = account_data.get("client_id") or ""
    record["access_token"] = account_data.get("access_token") or ""
    record["user_id"] = account_data.get("user_id") or ""
    save_account_meta(account_id, record)


def build_full_account_export_record(account: dict[str, Any], group: dict[str, Any] | None = None) -> dict[str, Any]:
    meta = load_account_meta(int(account["id"])) or {}
    core = {
        "id": int(account["id"]),
        "email": account.get("email", ""),
        "password": account.get("password", ""),
        "client_id": account.get("client_id", ""),
        "access_token": account.get("access_token", ""),
        "user_id": account.get("user_id", ""),
        "group_id": account.get("group_id"),
        "group_name": (group or {}).get("name") or account.get("group_name", ""),
        "remark": account.get("remark", ""),
        "status": account.get("status", "active"),
        "fetch_status": account.get("fetch_status", "unknown"),
        "last_http_status": account.get("last_http_status"),
        "last_official_error": account.get("last_official_error", ""),
        "last_fetch_step": account.get("last_fetch_step", ""),
        "session_refreshed_at": account.get("session_refreshed_at", ""),
        "last_error": account.get("last_error", ""),
        "last_check_at": account.get("last_check_at", ""),
        "created_at": account.get("created_at", ""),
        "updated_at": account.get("updated_at", ""),
    }
    merged_meta = dict(meta)
    merged_meta.update({
        "email": core["email"],
        "password": core["password"],
        "client_id": core["client_id"],
        "access_token": core["access_token"],
        "user_id": core["user_id"],
        "mail_domain": core["email"].split("@")[-1] if "@" in core["email"] else meta.get("mail_domain"),
    })
    return {
        "group": {
            "id": core["group_id"],
            "name": core["group_name"],
        },
        "account": core,
        "meta": merged_meta,
    }


def normalize_export_mode(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    return normalized if normalized in {"minimal", "full"} else "minimal"


def cleanup_export_verify_tokens() -> None:
    current_time = time.time()
    expired_tokens = [token for token, payload in EXPORT_VERIFY_TOKENS.items() if payload.get("expires", 0) < current_time]
    for token in expired_tokens:
        EXPORT_VERIFY_TOKENS.pop(token, None)


def build_accounts_export_content(group_ids: list[int], export_mode: str = "minimal") -> tuple[str, int, str, str]:
    export_mode = normalize_export_mode(export_mode)
    lines: list[str] = []
    total_count = 0
    for group_id in group_ids:
        group = load_group(int(group_id))
        if not group:
            continue
        accounts = load_accounts(int(group_id))
        if not accounts:
            continue
        if export_mode == "minimal":
            lines.append(group["name"])
            for account in accounts:
                lines.append("----".join([
                    account.get("email", ""),
                    account.get("password", ""),
                    account.get("client_id", ""),
                    account.get("access_token", ""),
                    account.get("user_id", ""),
                ]))
                total_count += 1
            lines.append("")
        else:
            for account in accounts:
                lines.append(json.dumps(build_full_account_export_record(account, group), ensure_ascii=False))
                total_count += 1
    while lines and not lines[-1]:
        lines.pop()
    if export_mode == "full":
        return "\n".join(lines), total_count, "jsonl", "application/x-ndjson; charset=utf-8"
    return "\n".join(lines), total_count, "txt", "text/plain; charset=utf-8"


def load_account(account_id: int | None = None, email: str | None = None) -> dict[str, Any] | None:
    if account_id is not None:
        cur = get_db().execute("""
            SELECT a.*, g.name AS group_name, g.color AS group_color
            FROM accounts a
            LEFT JOIN groups g ON g.id = a.group_id
            WHERE a.id = ?
        """, (account_id,))
    else:
        email = (email or "").strip()
        cur = get_db().execute("""
            SELECT a.*, g.name AS group_name, g.color AS group_color
            FROM accounts a
            LEFT JOIN groups g ON g.id = a.group_id
            WHERE lower(a.email) = lower(?)
        """, (email,))
    row = cur.fetchone()
    if not row:
        return None
    item = dict(row)
    item["password"] = decrypt_value(item["password_enc"])
    item.pop("password_enc", None)
    item["access_token"] = decrypt_value(item.get("access_token_enc"))
    item.pop("access_token_enc", None)
    item["fetch_status"] = normalize_account_fetch_status(item.get("fetch_status"))
    item["fetch_status_label"] = account_fetch_status_label(item["fetch_status"])
    item["fetch_status_tone"] = account_fetch_status_tone(item["fetch_status"])
    return item


def upsert_account(
    email: str,
    password: str,
    client_id: str | None,
    group_id: int,
    remark: str = "",
    access_token: str = "",
    user_id: str = "",
) -> int:
    email = (email or "").strip().lower()
    now = utc_now()
    db_execute("""
        INSERT INTO accounts (
            email, password_enc, client_id, access_token_enc, user_id, group_id, remark, status, fetch_status,
            last_http_status, last_official_error, last_fetch_step, session_refreshed_at, last_error, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'unknown', NULL, '', '', NULL, '', ?, ?)
        ON CONFLICT(email) DO UPDATE SET
            password_enc = excluded.password_enc,
            client_id = excluded.client_id,
            access_token_enc = excluded.access_token_enc,
            user_id = excluded.user_id,
            group_id = excluded.group_id,
            remark = excluded.remark,
            status = 'active',
            fetch_status = 'unknown',
            last_http_status = NULL,
            last_official_error = '',
            last_fetch_step = '',
            session_refreshed_at = NULL,
            last_error = '',
            updated_at = excluded.updated_at
    """, (
        email,
        encrypt_value(password),
        client_id or "",
        encrypt_value(access_token or ""),
        user_id or "",
        group_id,
        remark,
        now,
        now,
    ))
    cur = get_db().execute("SELECT id FROM accounts WHERE lower(email) = lower(?)", (email,))
    return int(cur.fetchone()["id"])


def update_account_fetch_state(account_id: int, fetch_status: str, last_error: str = "", *,
                               last_check_at: str | None = None,
                               client_id: str | None = None,
                               access_token: str | None = None,
                               user_id: str | None = None,
                               http_status: int | None = None,
                               official_error: str | None = None,
                               fetch_step: str | None = None,
                               session_refreshed_at: str | None = None) -> None:
    payload = {
        "fetch_status": normalize_account_fetch_status(fetch_status),
        "last_error": (last_error or "").strip(),
        "last_check_at": last_check_at,
        "updated_at": utc_now(),
    }
    if client_id is not None:
        payload["client_id"] = client_id
    if access_token is not None:
        payload["access_token_enc"] = encrypt_value(access_token)
    if user_id is not None:
        payload["user_id"] = user_id
    if http_status is not None:
        payload["last_http_status"] = int(http_status)
    if official_error is not None:
        payload["last_official_error"] = (official_error or "").strip()
    if fetch_step is not None:
        payload["last_fetch_step"] = (fetch_step or "").strip()
    if session_refreshed_at is not None:
        payload["session_refreshed_at"] = session_refreshed_at
    assignments = ", ".join(f"{key} = ?" for key in payload.keys())
    values = list(payload.values()) + [account_id]
    db_execute(f"UPDATE accounts SET {assignments} WHERE id = ?", tuple(values))


def delete_account(account_id: int) -> bool:
    db_execute("DELETE FROM account_meta WHERE account_id = ?", (account_id,))
    cur = db_execute("DELETE FROM accounts WHERE id = ?", (account_id,))
    return cur.rowcount > 0


def delete_accounts(account_ids: list[int]) -> int:
    valid_ids = [int(item) for item in account_ids if int(item) > 0]
    if not valid_ids:
        return 0
    placeholders = ",".join("?" for _ in valid_ids)
    db_execute(f"DELETE FROM account_meta WHERE account_id IN ({placeholders})", tuple(valid_ids))
    cur = db_execute(f"DELETE FROM accounts WHERE id IN ({placeholders})", tuple(valid_ids))
    return cur.rowcount


def parse_account_line(line: str) -> dict[str, str] | None:
    if not line or line.startswith("#"):
        return None
    parts = [part.strip() for part in line.split("----")]
    if len(parts) < 2:
        return None
    return {
        "email": parts[0],
        "password": parts[1],
        "client_id": parts[2] if len(parts) > 2 else "",
        "access_token": parts[3] if len(parts) > 3 else "",
        "user_id": parts[4] if len(parts) > 4 else "",
    }


def normalize_mail_id(value: Any) -> str:
    if isinstance(value, (list, tuple)):
        parts = [str(item) for item in value if item not in (None, "")]
        return "::".join(parts)
    return str(value or "")


SUPPORTED_FIXED_PROXY_SCHEMES = {"http", "https", "socks5", "socks4"}
SUPPORTED_DYNAMIC_PROXY_PROTOCOLS = {"http", "https", "socks5"}


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + chunk_type
        + data
        + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
    )


def build_model_validate_image_b64(size: int = 16) -> str:
    # 生成一张更常规的 RGB PNG，避免部分兼容网关误判极小 1x1 PNG 为无效图片。
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            if x in {0, size - 1} or y in {0, size - 1}:
                pixel = (32, 96, 160)
            elif (x // 4 + y // 4) % 2 == 0:
                pixel = (245, 245, 245)
            else:
                pixel = (220, 228, 240)
            row.extend(pixel)
        rows.append(bytes(row))
    raw = b"".join(rows)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            _png_chunk(b"IHDR", ihdr),
            _png_chunk(b"IDAT", zlib.compress(raw, 9)),
            _png_chunk(b"IEND", b""),
        ]
    )
    return base64.b64encode(png).decode("ascii")


def get_model_validate_image_data_uri() -> tuple[str, str]:
    # 优先使用本地真实验证码样例，验证结果更接近实际注册场景。
    candidate_dirs = [
        ROOT_DIR / "captchas" / "_thumbs",
        ROOT_DIR / "captchas",
    ]
    candidate_files: list[Path] = []
    for folder in candidate_dirs:
        if not folder.exists():
            continue
        for pattern in ("*.png", "*.jpg", "*.jpeg", "*.webp"):
            candidate_files.extend(folder.glob(pattern))
    if candidate_files:
        candidate_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        for path in candidate_files:
            try:
                mime = "image/png"
                suffix = path.suffix.lower()
                if suffix in {".jpg", ".jpeg"}:
                    mime = "image/jpeg"
                elif suffix == ".webp":
                    mime = "image/webp"
                data = base64.b64encode(path.read_bytes()).decode("ascii")
                return f"data:{mime};base64,{data}", f"real_sample:{path.name}"
            except Exception:
                continue
    fallback_b64 = build_model_validate_image_b64(size=16)
    return f"data:image/png;base64,{fallback_b64}", "generated_sample:16x16"


def normalize_dynamic_proxy_protocol(protocol: str | None) -> str:
    proto = (protocol or "socks5").strip().lower()
    if proto == "socks":
        return "socks5"
    if proto not in SUPPORTED_DYNAMIC_PROXY_PROTOCOLS:
        raise ValueError("动态代理协议仅支持 socks5 / http / https")
    return proto


def normalize_fixed_proxy_url(proxy_url: str | None) -> str:
    value = (proxy_url or "").strip()
    if not value:
        return ""
    if value.lower().startswith("socks://"):
        value = "socks5://" + value[8:]
    parsed = urlparse(value)
    scheme = (parsed.scheme or "").strip().lower()
    if not scheme:
        raise ValueError("固定代理必须带协议头，例如 socks5://127.0.0.1:7890")
    if scheme not in SUPPORTED_FIXED_PROXY_SCHEMES:
        raise ValueError("固定代理协议仅支持 socks5 / socks4 / http / https")
    if not parsed.hostname or parsed.port is None:
        raise ValueError("固定代理格式无效，请检查 host:port")
    if scheme != parsed.scheme:
        netloc = value.split("://", 1)[1]
        value = f"{scheme}://{netloc}"
    return value


def normalize_proxy_profile_payload(data: dict[str, Any]) -> dict[str, Any]:
    mode = (data.get("mode") or "none").strip().lower()
    if mode not in {"none", "fixed", "dynamic"}:
        raise ValueError("代理模式仅支持 none / fixed / dynamic")
    payload = {
        "name": (data.get("name") or "").strip(),
        "mode": mode,
        "proxy_url": "",
        "dynamic_proxy_url": "",
        "dynamic_proxy_protocol": "socks5",
        "enabled": 1 if data.get("enabled", True) else 0,
    }
    if mode == "fixed":
        payload["proxy_url"] = normalize_fixed_proxy_url(data.get("proxy_url"))
        if not payload["proxy_url"]:
            raise ValueError("固定代理模式必须填写代理地址")
    elif mode == "dynamic":
        payload["dynamic_proxy_url"] = (data.get("dynamic_proxy_url") or "").strip()
        if not payload["dynamic_proxy_url"]:
            raise ValueError("动态代理模式必须填写接口地址")
        payload["dynamic_proxy_protocol"] = normalize_dynamic_proxy_protocol(data.get("dynamic_proxy_protocol"))
    return payload


def test_proxy_connectivity(proxy_url: str) -> tuple[int, dict[str, Any], float]:
    started = time.perf_counter()
    tester = WebTutaRegister(proxy=proxy_url, tag="proxytest", logger=None)
    status, data = tester.solve_timelock_captcha()
    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    return status, data, elapsed_ms


def normalize_model_profile_payload(data: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "name": (data.get("name") or "").strip(),
        "api_key": (data.get("api_key") or "").strip(),
        "base_url": (data.get("base_url") or "").strip(),
        "model_name": (data.get("model_name") or "").strip(),
        "priority": int(data.get("priority") or 10),
        "enabled": 1 if data.get("enabled", True) else 0,
    }
    if not payload["name"]:
        raise ValueError("模型名称不能为空")
    if not payload["api_key"]:
        raise ValueError("API Key 不能为空")
    if not payload["base_url"]:
        raise ValueError("Base URL 不能为空")
    if not payload["model_name"]:
        raise ValueError("模型名不能为空")
    return payload


def _extract_model_response_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())
        return " ".join(parts).strip()
    return ""


def _extract_choice_text(choice: Any) -> str:
    if not isinstance(choice, dict):
        return ""
    message = choice.get("message")
    if isinstance(message, dict):
        text = _extract_model_response_text(message.get("content"))
        if text:
            return text
    delta = choice.get("delta")
    if isinstance(delta, dict):
        text = _extract_model_response_text(delta.get("content"))
        if text:
            return text
    return ""


def _parse_sse_response_text(body: str) -> str:
    parts: list[str] = []
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line or not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            item = json.loads(payload)
        except Exception:
            continue
        choices = item.get("choices") if isinstance(item, dict) else None
        if not isinstance(choices, list):
            continue
        for choice in choices:
            text = _extract_choice_text(choice)
            if text:
                parts.append(text)
    return "".join(parts).strip()


def _send_model_validation_request(
    chat_url: str,
    headers: dict[str, str],
    base_url: str,
    request_payload: dict[str, Any],
) -> tuple[int, str, float]:
    body_bytes = json.dumps(request_payload, ensure_ascii=False).encode("utf-8")
    started = time.perf_counter()
    resp = curl_requests.post(
        chat_url,
        data=body_bytes,
        headers={
            **headers,
            "Accept": "application/json",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/134.0.0.0 Safari/537.36"
            ),
            "Origin": base_url.rstrip("/"),
            "Referer": base_url.rstrip("/") + "/",
        },
        impersonate="chrome136",
        timeout=30,
    )
    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    body = resp.text
    status = resp.status_code
    body_lower = body.lower()
    # 兼容 vLLM / FastAPI：某些端点会对浏览器仿真请求误判成缺失 body，
    # 此时回退到最朴素的原始 JSON POST。
    if status == 400 and "field required" in body_lower and "body" in body_lower:
        started = time.perf_counter()
        req = urllib.request.Request(chat_url, data=body_bytes, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as raw_resp:
                body = raw_resp.read().decode("utf-8", errors="replace")
                status = getattr(raw_resp, "status", 200)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            status = exc.code
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
        return status, body, elapsed_ms
    return status, body, elapsed_ms


def _parse_model_validation_response(status: int, body: str) -> str:
    if status != 200:
        raise RuntimeError(f"HTTP {status}: {body[:300]}")
    try:
        data = json.loads(body)
    except Exception:
        text = _parse_sse_response_text(body)
        if text:
            return text
        raise RuntimeError(f"响应不是合法 JSON: {body[:300]}")
    choices = data.get("choices") if isinstance(data, dict) else None
    if not isinstance(choices, list) or not choices:
        text = _parse_sse_response_text(body)
        if text:
            return text
        raise RuntimeError(f"响应缺少 choices: {body[:300]}")
    text = _extract_choice_text(choices[0])
    if not text:
        text = _parse_sse_response_text(body)
        if text:
            return text
        raise RuntimeError("模型返回为空，或不包含 message.content / delta.content")
    return text


def test_model_profile(payload: dict[str, Any], validate_mode: str = "vision") -> dict[str, Any]:
    chat_url = tuta_mod.CaptchaTimeSolver._resolve_chat_url(payload["base_url"])
    if not chat_url:
        raise ValueError("Base URL 无效")
    mode = (validate_mode or "vision").strip().lower()
    if mode not in {"text", "vision"}:
        raise ValueError("验证模式仅支持 text / vision")
    if mode == "vision":
        system_content = 'Return strict JSON only: {"ok":true,"mode":"vision"}'
    else:
        user_content = "Reply with strict JSON only: {\"ok\":true,\"mode\":\"text\"}"
        system_content = "You are a validation endpoint. Return JSON only."
    headers = {
        "Authorization": f"Bearer {payload['api_key']}",
        "Content-Type": "application/json",
    }
    attempts: list[tuple[str, dict[str, Any]]] = []
    sample_source = ""
    if mode == "vision":
        image_data_uri, sample_source = get_model_validate_image_data_uri()
        attempts = [
            (
                "openai_image_object",
                {
                    "model": payload["model_name"],
                    "messages": [
                        {"role": "system", "content": system_content},
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "This is a model validation request. Reply with JSON only."},
                                {"type": "image_url", "image_url": {"url": image_data_uri}},
                            ],
                        },
                    ],
                    "temperature": 0,
                    "max_tokens": 64,
                    "stream": False,
                },
            ),
            (
                "openai_image_string",
                {
                    "model": payload["model_name"],
                    "messages": [
                        {"role": "system", "content": system_content},
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "This is a model validation request. Reply with JSON only."},
                                {"type": "image_url", "image_url": image_data_uri},
                            ],
                        },
                    ],
                    "temperature": 0,
                    "max_tokens": 64,
                    "stream": False,
                },
            ),
        ]
    else:
        attempts = [
            (
                "text_only",
                {
                    "model": payload["model_name"],
                    "messages": [
                        {"role": "system", "content": system_content},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": 0,
                    "max_tokens": 64,
                    "stream": False,
                },
            )
        ]

    errors: list[str] = []
    final_elapsed = 0.0
    text = ""
    succeeded_variant = ""
    for variant, request_payload in attempts:
        try:
            status, body, elapsed_ms = _send_model_validation_request(
                chat_url,
                headers,
                payload["base_url"],
                request_payload,
            )
            final_elapsed = elapsed_ms
            text = _parse_model_validation_response(status, body)
            succeeded_variant = variant
            break
        except Exception as exc:
            errors.append(f"{variant}: {str(exc)[:300]}")
    if not text:
        detail = " | ".join(errors) if errors else "未知错误"
        if mode == "vision":
            raise RuntimeError(
                "视觉验证失败，接口可能不支持当前图片提交格式（data:image base64）或不兼容当前 OpenAI 图片消息结构。"
                f" 详情: {detail}"
            )
        raise RuntimeError(detail)
    return {
        "mode": mode,
        "variant": succeeded_variant,
        "chat_url": chat_url,
        "latency_ms": final_elapsed,
        "response_preview": text[:200],
        "sample_source": sample_source,
    }


def resolve_proxy(profile: dict[str, Any] | None) -> str | None:
    if not profile:
        return None
    mode = (profile.get("mode") or "none").strip().lower()
    if mode == "none":
        return None
    if mode == "fixed":
        return normalize_fixed_proxy_url(profile.get("proxy_url")) or None
    if mode == "dynamic":
        url = (profile.get("dynamic_proxy_url") or "").strip()
        protocol = normalize_dynamic_proxy_protocol(profile.get("dynamic_proxy_protocol"))
        return tuta_mod._fetch_dynamic_proxy(url, protocol)
    return None


@contextmanager
def captcha_model_chain(models: list[dict[str, Any]], task_logger=None):
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

    def active_profiles() -> list[dict[str, Any]]:
        profiles = [item for item in models if item.get("enabled")]
        if not profiles:
            raise RuntimeError("未配置可用识别模型")
        return profiles

    def profile_name(profile: dict[str, Any]) -> str:
        return (profile.get("name") or profile.get("model_name") or "unnamed").strip()

    def apply_profile(profile: dict[str, Any]) -> None:
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
        try:
            return original_chat(messages, timeout=timeout)
        except Exception as exc:
            current = rotation_state.get("current_profile") or {}
            current_name = profile_name(current) if current else "当前模型"
            if task_logger:
                task_logger(f"[模型] {current_name} 失败: {exc}", "warning")
            raise RuntimeError(f"{current_name}: {exc}") from exc

    @classmethod
    def patched_solve_time(cls, image_b64: str, tag: str = ""):
        profiles = active_profiles()
        profile = profiles[rotation_state["cursor"] % len(profiles)]
        rotation_state["cursor"] = (rotation_state["cursor"] + 1) % len(profiles)
        rotation_state["attempt"] += 1
        rotation_state["current_profile"] = profile
        apply_profile(profile)
        if task_logger:
            task_logger(
                f"[模型] 第{rotation_state['attempt']}次识别使用 {profile_name(profile)}",
                "debug",
            )
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


class WebTutaRegister(TutaRegister):
    def __init__(self, proxy: str | None, tag: str, logger=None):
        self.web_logger = logger
        super().__init__(proxy=proxy, tag=tag)

    def _print(self, msg):
        if self.web_logger:
            self.web_logger(msg, "info")

    def _log(self, step, method, url, status, body=None):
        level = "error" if int(status) >= 400 else "debug"
        if self.web_logger:
            self.web_logger(f"{step} | {method} {url} -> {status}", level)
            if body and int(status) >= 400:
                try:
                    text = json.dumps(body, ensure_ascii=False)[:400]
                except Exception:
                    text = str(body)[:400]
                self.web_logger(f"{step} 响应: {text}", "warning")

class TaskManager:
    def __init__(self) -> None:
        self.tasks: dict[str, dict[str, Any]] = {}
        self.lock = threading.Lock()

    def create(self, payload: dict[str, Any]) -> str:
        task_id = str(uuid.uuid4())
        with self.lock:
            self.tasks[task_id] = {
                "id": task_id,
                "payload": payload,
                "status": "pending",
                "logs": [{"ts": utc_now(), "level": "info", "message": "[系统] 任务已创建"}],
                "created_at": utc_now(),
                "updated_at": utc_now(),
                "progress": {"total": int(payload.get("batch_count", 1) or 1), "done": 0, "success": 0, "failed": 0},
                "results": [],
                "cancel_requested": False,
                "error": "",
            }
        return task_id

    def log(self, task_id: str, message: str, level: str = "info") -> None:
        with self.lock:
            task = self.tasks.get(task_id)
            if not task:
                return
            task["logs"].append({"ts": utc_now(), "level": level, "message": message})
            task["updated_at"] = utc_now()

    def update(self, task_id: str, **fields) -> None:
        with self.lock:
            task = self.tasks.get(task_id)
            if not task:
                return
            task.update(fields)
            task["updated_at"] = utc_now()

    def update_progress(self, task_id: str, **fields) -> None:
        with self.lock:
            task = self.tasks.get(task_id)
            if not task:
                return
            task["progress"].update(fields)
            task["updated_at"] = utc_now()

    def append_result(self, task_id: str, result: dict[str, Any]) -> None:
        with self.lock:
            task = self.tasks.get(task_id)
            if not task:
                return
            task["results"].append(result)
            task["updated_at"] = utc_now()

    def get(self, task_id: str) -> dict[str, Any] | None:
        with self.lock:
            task = self.tasks.get(task_id)
            return json.loads(json.dumps(task)) if task else None


TASK_MANAGER = TaskManager()
REGISTRATION_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="tutamail-reg")
MAIL_REFRESH_TASK_MANAGER = TaskManager()
MAIL_REFRESH_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="tutamail-mail-refresh")
MAIL_CACHE: dict[str, dict[str, Any]] = {}
MAIL_CACHE_LOCK = threading.Lock()
EXPORT_VERIFY_TOKENS: dict[str, dict[str, Any]] = {}


def build_mail_meta_map(index_messages: list[dict[str, Any]]) -> dict[str, dict[str, str]]:
    meta_map: dict[str, dict[str, str]] = {}
    for item in index_messages:
        mail_id = normalize_mail_id(item.get("99"))
        if not mail_id:
            continue
        sender = extract_contact_email(item.get("111")) or extract_contact_email(item.get("118")) or ""
        recipient = extract_contact_email(item.get("1306")) or extract_contact_email(item.get("116")) or ""
        meta_map[mail_id] = {
            "from": sender or "未知发件人",
            "to": recipient,
        }
    return meta_map


def build_formatted_mail_cache(readable_messages: list[dict[str, Any]], index_messages: list[dict[str, Any]]) -> dict[str, Any]:
    meta_map = build_mail_meta_map(index_messages)
    items: list[dict[str, Any]] = []
    bucket: dict[str, dict[str, Any]] = {}

    for item in readable_messages:
        body = item.get("body") or ""
        body_text = strip_html(body)
        mail_id = normalize_mail_id(item.get("mail_id"))
        if not mail_id:
            continue

        mail_meta = meta_map.get(mail_id, {})
        raw_date = item.get("received_date_iso") or item.get("sent_date_iso") or ""
        row = {
            "id": mail_id,
            "subject": item.get("subject") or "无主题",
            "from": mail_meta.get("from") or "未知发件人",
            "to": mail_meta.get("to") or "",
            "date": raw_date,
            "date_display": format_mail_datetime(raw_date),
            "body_preview": (body_text[:160] + "...") if len(body_text) > 160 else body_text,
            "body": sanitize_mail_html(body),
            "body_text": body_text,
        }
        bucket[row["id"]] = row
        items.append(row)

    return {"items": items, "bucket": bucket}


def read_mail_cache_from_disk(email_addr: str) -> dict[str, Any]:
    output_dir = MAIL_CACHE_DIR / safe_slug(email_addr)
    readable_path = output_dir / "mail_readable.json"
    index_path = output_dir / "mail_index.json"
    if not readable_path.exists():
        return {"items": [], "bucket": {}}

    try:
        readable_messages = json.loads(readable_path.read_text(encoding="utf-8"))
    except Exception:
        readable_messages = []

    try:
        index_messages = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else []
    except Exception:
        index_messages = []

    cache_data = build_formatted_mail_cache(readable_messages, index_messages)
    with MAIL_CACHE_LOCK:
        MAIL_CACHE[email_addr] = cache_data
    return cache_data


def get_account_mail_cache(email_addr: str) -> dict[str, Any]:
    with MAIL_CACHE_LOCK:
        cached = MAIL_CACHE.get(email_addr)
    if cached is not None:
        return cached
    return read_mail_cache_from_disk(email_addr)
CAPTCHA_PATCH_LOCK = threading.Lock()


def registration_python_executable() -> str:
    venv_python = APP_DIR / ".venv" / "Scripts" / "python.exe"
    if venv_python.exists():
        return str(venv_python)
    return sys.executable


def run_register_worker(
    email_addr: str,
    password: str,
    proxy: str | None,
    models: list[dict[str, Any]],
    captcha_settings: dict[str, Any],
    logger,
) -> dict[str, Any]:
    worker_path = APP_DIR / "register_worker.py"
    cmd = [
        registration_python_executable(),
        "-u",
        str(worker_path),
        "--email",
        email_addr,
        "--password",
        password,
        "--tag",
        (email_addr.split("@")[0] if "@" in email_addr else "worker"),
        "--models-json",
        json.dumps(models, ensure_ascii=False),
        "--captcha-settings-json",
        json.dumps(captcha_settings, ensure_ascii=False),
    ]
    if proxy:
        cmd.extend(["--proxy", proxy])

    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    proc = subprocess.Popen(
        cmd,
        cwd=str(ROOT_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )

    result_payload: dict[str, Any] | None = None
    if proc.stdout is not None:
        for raw_line in proc.stdout:
            line = raw_line.rstrip("\r\n")
            if not line:
                continue
            if line.startswith("__RESULT__"):
                try:
                    result_payload = json.loads(line[len("__RESULT__"):])
                except Exception as exc:
                    logger(f"解析注册结果失败: {exc}", "error")
                continue
            logger(line, "info")

    proc.wait(timeout=30)
    if result_payload is None:
        raise RuntimeError(f"注册 worker 未返回结果，退出码={proc.returncode}")
    if proc.returncode not in (0, None) and not result_payload.get("ok"):
        result_payload.setdefault("error", f"worker exited with code {proc.returncode}")
    return result_payload


def get_account_proxy_profile(account: dict[str, Any]) -> dict[str, Any] | None:
    group_id = int(account.get("group_id") or 1)
    proxy_profile_id = int(get_setting(f"group_proxy_profile_{group_id}", "1") or "1")
    return load_proxy_profile(proxy_profile_id)


def _extract_status_code_from_message(message: str) -> int | None:
    raw = (message or "").strip()
    match = re.search(r"(?:失败|error|status)\s*[:=]?\s*(\d{3})", raw, re.IGNORECASE)
    if match:
        try:
            return int(match.group(1))
        except Exception:
            return None
    return None


def build_fetch_error_info(message: str, *, step: str = "", status: int | None = None, response_body: Any = None) -> dict[str, Any]:
    normalized_message = (message or "").strip()
    if tuta_mod._is_network_error(normalized_message):
        return {
            "fetch_status": "network_error",
            "http_status": status,
            "official_error": "ConnectionError",
            "official_label": "连接错误",
            "step": (step or "").strip(),
            "message": normalized_message,
            "response_body": response_body,
            "can_retry_with_password": False,
        }

    if status is None:
        status = _extract_status_code_from_message(normalized_message)

    error_info = tuta_mod.build_tuta_error_info(status, step=step, message=normalized_message, response_body=response_body)
    fetch_status = OFFICIAL_ERROR_TO_FETCH_STATUS.get(error_info["official_error"], "unknown")
    return {
        "fetch_status": normalize_account_fetch_status(fetch_status),
        "http_status": error_info["http_status"],
        "official_error": error_info["official_error"],
        "official_label": error_info["official_label"],
        "step": error_info["step"],
        "message": normalized_message,
        "response_body": response_body,
        "can_retry_with_password": error_info["official_error"] in {"NotAuthenticatedError", "NotAuthorizedError", "SessionExpiredError", "NotFoundError"},
    }


def classify_fetch_failure(message: str, *, step: str = "", status: int | None = None) -> str:
    return build_fetch_error_info(message, step=step, status=status)["fetch_status"]


def format_fetch_failure(message: str, fetch_status: str, *, http_status: int | None = None, official_error: str = "", step: str = "") -> str:
    label = account_fetch_status_label(fetch_status)
    parts = [label]
    meta = []
    if official_error:
        meta.append(official_error)
    if http_status is not None:
        meta.append(str(http_status))
    if step:
        meta.append(step)
    if meta:
        parts.append(f"({' / '.join(meta)})")
    clean_message = (message or "").strip()
    if clean_message:
        parts.append(clean_message)
    return "：".join([parts[0], " ".join(parts[1:]).strip()]) if len(parts) > 1 else parts[0]


def create_account_fetch_error(message: str, *, step: str = "", status: int | None = None, response_body: Any = None) -> AccountFetchError:
    info = build_fetch_error_info(message, step=step, status=status, response_body=response_body)
    return AccountFetchError(
        format_fetch_failure(
            info["message"],
            info["fetch_status"],
            http_status=info["http_status"],
            official_error=info["official_error"],
            step=info["step"],
        ),
        info["fetch_status"],
        http_status=info["http_status"],
        official_error=info["official_error"],
        step=info["step"],
        response_body=info["response_body"],
        can_retry_with_password=info["can_retry_with_password"],
    )


def should_retry_with_password_refresh(error: AccountFetchError | dict[str, Any] | None) -> bool:
    if error is None:
        return False
    if isinstance(error, dict):
        official_error = (error.get("official_error") or "").strip()
        return official_error in {"NotAuthenticatedError", "NotAuthorizedError", "SessionExpiredError", "NotFoundError"}
    return error.official_error in {"NotAuthenticatedError", "NotAuthorizedError", "SessionExpiredError", "NotFoundError"}


def ensure_account_session(account: dict[str, Any], reg: WebTutaRegister) -> tuple[dict[str, Any], bool]:
    login_email = (account["email"] or "").strip().lower()
    password = account["password"]
    user = None
    refreshed = False

    if account.get("client_id"):
        reg.client_id = account["client_id"]
    if account.get("access_token"):
        reg.access_token = account["access_token"]
        reg.session.headers["accessToken"] = account["access_token"]
    if account.get("user_id"):
        reg.user_id = account["user_id"]

    if reg.access_token and reg.user_id:
        status, user = reg.get_user()
        if status == 200 and user:
            return user, refreshed

        token_error = create_account_fetch_error(
            f"获取用户失败: {status}",
            step="user",
            status=status,
            response_body=user,
        )
        if not should_retry_with_password_refresh(token_error):
            raise token_error

        reg.access_token = None
        reg.user_id = None
        reg.session.headers.pop("accessToken", None)
        user = None
        had_prior_session = bool(account.get("access_token") and account.get("user_id"))
    else:
        had_prior_session = bool(account.get("access_token") and account.get("user_id"))

    status, salt_data = reg.get_salt(login_email)
    if status != 200:
        raise create_account_fetch_error(
            f"获取 salt 失败: {status} {salt_data}",
            step="salt",
            status=status,
            response_body=salt_data,
        )

    status, session_data = reg.create_session(login_email, password, salt_data.get("422", ""))
    if status not in (200, 201):
        if status == 401 and had_prior_session:
            raise AccountFetchError(
                format_fetch_failure(
                    f"创建 session 失败: {status} {session_data}",
                    "account_exists_but_login_revoked",
                    http_status=status,
                    official_error="NotAuthenticatedError",
                    step="session",
                ),
                "account_exists_but_login_revoked",
                http_status=status,
                official_error="NotAuthenticatedError",
                step="session",
                response_body=session_data,
                can_retry_with_password=False,
            )
        raise create_account_fetch_error(
            f"创建 session 失败: {status} {session_data}",
            step="session",
            status=status,
            response_body=session_data,
        )

    status, user = reg.get_user()
    if status != 200 or not user:
        raise create_account_fetch_error(
            f"获取用户失败: {status}",
            step="user",
            status=status,
            response_body=user,
        )

    refreshed = True
    return user, refreshed


def fetch_account_inbox(account: dict[str, Any], skip: int = 0, top: int = 20) -> dict[str, Any]:
    try:
        if skip < 0:
            skip = 0
        top = max(1, min(top, 50))
        login_email = (account["email"] or "").strip().lower()
        password = account["password"]
        proxy = resolve_proxy(get_account_proxy_profile(account))
        reg = WebTutaRegister(proxy=proxy, tag=login_email.split("@")[0], logger=None)
        user, refreshed = ensure_account_session(account, reg)

        output_dir = MAIL_CACHE_DIR / safe_slug(account["email"])
        if output_dir.exists():
            shutil.rmtree(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        fetch_count = min(max(skip + top + 20, 40), 100)
        reg.download_mail_details(output_dir=str(output_dir), max_mails=fetch_count, decrypt=True, password=password, user_data=user)

        readable_path = output_dir / "mail_readable.json"
        index_path = output_dir / "mail_index.json"
        readable_messages = json.loads(readable_path.read_text(encoding="utf-8")) if readable_path.exists() else []
        index_messages = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else []
        cache_data = build_formatted_mail_cache(readable_messages, index_messages)

        with MAIL_CACHE_LOCK:
            MAIL_CACHE[account["email"]] = cache_data

        update_account_fetch_state(
            account["id"],
            "ok",
            "",
            last_check_at=utc_now(),
            client_id=reg.client_id or "",
            access_token=reg.access_token or "",
            user_id=reg.user_id or "",
            http_status=200,
            official_error="",
            fetch_step="mail_fetch",
            session_refreshed_at=utc_now() if refreshed else None,
        )
        refreshed_account = load_account(account_id=int(account["id"]))
        if refreshed_account:
            sync_account_meta_core(int(account["id"]), refreshed_account)
        items = cache_data["items"]
        return {"emails": items[skip: skip + top], "has_more": len(items) > skip + top, "method": "Tuta Inbox"}
    except AccountFetchError:
        raise
    except Exception as exc:
        raise create_account_fetch_error(str(exc)) from exc


def refresh_account_session_tokens(account: dict[str, Any]) -> dict[str, Any]:
    proxy = resolve_proxy(get_account_proxy_profile(account))
    reg = WebTutaRegister(proxy=proxy, tag=(account["email"] or "").split("@")[0], logger=None)
    user, refreshed = ensure_account_session(account, reg)
    refreshed_at = utc_now()
    update_account_fetch_state(
        int(account["id"]),
        "ok",
        "",
        last_check_at=refreshed_at,
        client_id=reg.client_id or "",
        access_token=reg.access_token or "",
        user_id=reg.user_id or "",
        http_status=200,
        official_error="",
        fetch_step="session_refresh",
        session_refreshed_at=refreshed_at if refreshed else account.get("session_refreshed_at"),
    )
    refreshed_account = load_account(account_id=int(account["id"]))
    if refreshed_account:
        sync_account_meta_core(int(account["id"]), refreshed_account)
    return {
        "account_id": int(account["id"]),
        "email": account.get("email", ""),
        "client_id": reg.client_id or "",
        "access_token": reg.access_token or "",
        "user_id": reg.user_id or "",
        "session_refreshed": bool(refreshed),
        "session_refreshed_at": refreshed_at if refreshed else (refreshed_account or {}).get("session_refreshed_at", ""),
        "fetch_status": "ok",
        "fetch_status_label": account_fetch_status_label("ok"),
        "user_loaded": bool(user),
    }


def probe_account_status(account: dict[str, Any]) -> dict[str, Any]:
    proxy = resolve_proxy(get_account_proxy_profile(account))
    reg = WebTutaRegister(proxy=proxy, tag=(account["email"] or "").split("@")[0], logger=None)
    refreshed_at = utc_now()
    user, refreshed = ensure_account_session(account, reg)
    fetch_step = "status_probe"
    update_account_fetch_state(
        int(account["id"]),
        "ok",
        "",
        last_check_at=refreshed_at,
        client_id=reg.client_id or "",
        access_token=reg.access_token or "",
        user_id=reg.user_id or "",
        http_status=200,
        official_error="",
        fetch_step=fetch_step,
        session_refreshed_at=refreshed_at if refreshed else account.get("session_refreshed_at"),
    )
    refreshed_account = load_account(account_id=int(account["id"]))
    if refreshed_account:
        sync_account_meta_core(int(account["id"]), refreshed_account)
    return {
        "account_id": int(account["id"]),
        "email": account.get("email", ""),
        "fetch_status": "ok",
        "fetch_status_label": account_fetch_status_label("ok"),
        "session_refreshed": bool(refreshed),
        "session_refreshed_at": refreshed_at if refreshed else (refreshed_account or {}).get("session_refreshed_at", ""),
        "user_loaded": bool(user),
    }


def get_cached_mail_detail(email_addr: str, mail_id: str) -> dict[str, Any] | None:
    cache_data = get_account_mail_cache(email_addr)
    return cache_data.get("bucket", {}).get(mail_id)


def run_registration_task(task_id: str) -> None:
    with app.app_context():
        task = TASK_MANAGER.get(task_id)
        if not task:
            return

        payload = task["payload"]
        batch_count = max(1, int(payload.get("batch_count", 1) or 1))
        max_workers = max(1, min(int(payload.get("max_workers", 1) or 1), 10))
        domain = payload.get("mail_domain") or TUTA_FREE_DOMAINS[0]
        group_id = int(payload.get("group_id") or 1)
        proxy_profile = load_proxy_profile(int(payload.get("proxy_profile_id") or 1))
        selected_model_ids = payload.get("model_profile_ids") or []
        captcha_settings = get_captcha_settings()

        models = load_model_profiles(enabled_only=False)
        if selected_model_ids:
            models = [item for item in models if item["id"] in selected_model_ids and item["enabled"]]
        else:
            models = [item for item in models if item["enabled"]]

        TASK_MANAGER.update(task_id, status="running")
        TASK_MANAGER.log(task_id, f"[系统] 开始注册任务，共 {batch_count} 个账号，并发 {max_workers}")
        TASK_MANAGER.log(task_id, f"[系统] 目标域名: {domain}")
        TASK_MANAGER.log(task_id, f"[系统] 代理配置: {(proxy_profile or {}).get('name', '不使用代理')}")
        if not models:
            TASK_MANAGER.log(task_id, "[系统] 未配置可用识别模型", "error")
            TASK_MANAGER.update(task_id, status="failed", error="未配置可用识别模型")
            return
        TASK_MANAGER.log(task_id, "[系统] 识别模型链: " + " -> ".join(item["name"] for item in models))

        progress = {"done": 0, "success": 0, "failed": 0, "total": batch_count}
        progress_lock = threading.Lock()

        def task_logger_factory(index: int):
            def _logger(message: str, level: str = "info") -> None:
                TASK_MANAGER.log(task_id, f"[任务{index}] {message}", level)
            return _logger

        def register_one(index: int) -> dict[str, Any]:
            if TASK_MANAGER.get(task_id).get("cancel_requested"):
                return {"ok": False, "cancelled": True, "error": "任务已取消"}
            logger = task_logger_factory(index)
            email_prefix = tuta_mod._random_email_prefix()
            email_addr = f"{email_prefix}@{domain}"
            password = tuta_mod._generate_password()
            logger(f"准备注册邮箱 {email_addr}")
            attempts = 0
            max_proxy_attempts = 5
            last_error = ""

            while attempts < max_proxy_attempts:
                attempts += 1
                try:
                    proxy = resolve_proxy(proxy_profile)
                    if proxy:
                        logger(f"当前代理: {proxy}", "debug")
                    result = run_register_worker(email_addr, password, proxy, models, captcha_settings, logger)
                    if result.get("ok"):
                        remark = "Web 自动注册"
                        if not result.get("session_ready", False):
                            remark = "Web 自动注册（登录态待补全）"
                        account_id = upsert_account(
                            email_addr,
                            password,
                            result.get("client_id"),
                            group_id,
                            remark,
                            result.get("access_token") or "",
                            result.get("user_id") or "",
                        )
                        save_account_meta(account_id, result.get("account_record"))
                        if result.get("session_ready", False):
                            logger(f"注册成功，已入库账号 ID={account_id}", "success")
                        else:
                            logger(
                                "账号已创建并入库，但当前未拿到 access_token/user_id；"
                                "后续收件时会自动再次登录补全。",
                                "warning",
                            )
                            if result.get("session_error", ""):
                                logger(f"Step 7 延迟补全原因: {result['session_error']}", "warning")
                        return {
                            "ok": True,
                            "email": email_addr,
                            "password": password,
                            "client_id": result.get("client_id"),
                            "access_token": result.get("access_token"),
                            "user_id": result.get("user_id"),
                            "account_id": account_id,
                            "session_ready": bool(result.get("session_ready", False)),
                            "session_error": result.get("session_error", ""),
                        }
                    last_error = result.get("error") or result.get("last_error") or "注册失败"
                    logger(f"注册失败: {last_error}", "error")
                    if proxy_profile and proxy_profile.get("mode") == "dynamic" and tuta_mod._is_network_error(last_error):
                        logger("动态代理疑似网络异常，尝试重新获取代理", "warning")
                        continue
                    break
                except Exception as exc:
                    last_error = str(exc)
                    logger(f"异常: {exc}", "error")
                    if proxy_profile and proxy_profile.get("mode") == "dynamic" and tuta_mod._is_network_error(last_error):
                        logger("动态代理异常，重新获取代理后重试", "warning")
                        continue
                    break

            return {"ok": False, "email": email_addr, "error": last_error or "注册失败"}

        started = time.time()
        if batch_count == 1 or max_workers == 1:
            for index in range(1, batch_count + 1):
                if TASK_MANAGER.get(task_id).get("cancel_requested"):
                    TASK_MANAGER.log(task_id, "[系统] 收到取消请求，停止后续任务", "warning")
                    break
                result = register_one(index)
                TASK_MANAGER.append_result(task_id, result)
                with progress_lock:
                    progress["done"] += 1
                    if result.get("ok"):
                        progress["success"] += 1
                    elif not result.get("cancelled"):
                        progress["failed"] += 1
                    TASK_MANAGER.update_progress(task_id, **progress)
        else:
            futures = {}
            with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="tuta-batch") as executor:
                for index in range(1, batch_count + 1):
                    if TASK_MANAGER.get(task_id).get("cancel_requested"):
                        break
                    futures[executor.submit(register_one, index)] = index
                for future in as_completed(futures):
                    result = future.result()
                    TASK_MANAGER.append_result(task_id, result)
                    with progress_lock:
                        progress["done"] += 1
                        if result.get("ok"):
                            progress["success"] += 1
                        elif not result.get("cancelled"):
                            progress["failed"] += 1
                        TASK_MANAGER.update_progress(task_id, **progress)

        duration = round(time.time() - started, 1)
        final_task = TASK_MANAGER.get(task_id)
        if final_task.get("cancel_requested"):
            TASK_MANAGER.update(task_id, status="cancelled")
            TASK_MANAGER.log(task_id, f"[系统] 任务已取消，耗时 {duration}s", "warning")
        elif progress["success"] == 0 and progress["failed"] > 0:
            TASK_MANAGER.update(task_id, status="failed", error="全部注册失败")
            TASK_MANAGER.log(task_id, f"[系统] 任务完成，全部失败，耗时 {duration}s", "error")
        else:
            TASK_MANAGER.update(task_id, status="completed")
            TASK_MANAGER.log(task_id, f"[系统] 任务完成：成功 {progress['success']}，失败 {progress['failed']}，耗时 {duration}s", "success")


def start_registration_task(payload: dict[str, Any]) -> str:
    task_id = TASK_MANAGER.create(payload)
    REGISTRATION_EXECUTOR.submit(run_registration_task, task_id)
    return task_id


def run_mail_refresh_task(task_id: str) -> None:
    with app.app_context():
        task = MAIL_REFRESH_TASK_MANAGER.get(task_id)
        if not task:
            return

        payload = task["payload"]
        scope = (payload.get("scope") or "group").strip()
        group_id = int(payload.get("group_id") or 0)
        include_disabled = bool(payload.get("include_disabled"))
        account_ids = [int(item) for item in (payload.get("account_ids") or []) if int(item) > 0]

        if scope == "selected":
            accounts = load_accounts_by_ids(account_ids)
        else:
            accounts = load_accounts(group_id if scope == "group" and group_id else None)
        if not include_disabled:
            accounts = [item for item in accounts if (item.get("status") or "active") != "disabled"]

        if scope == "group" and group_id:
            group = load_group(group_id)
            scope_label = f"分组 {group['name']}" if group else f"分组 {group_id}"
        elif scope == "selected":
            scope_label = f"已选账号 {len(accounts)} 个"
        else:
            scope_label = "全部分组"

        total = len(accounts)
        MAIL_REFRESH_TASK_MANAGER.update(task_id, status="running")
        MAIL_REFRESH_TASK_MANAGER.update_progress(task_id, total=total, done=0, success=0, failed=0)
        MAIL_REFRESH_TASK_MANAGER.log(task_id, f"[系统] 开始批量取件：{scope_label}")
        MAIL_REFRESH_TASK_MANAGER.log(task_id, f"[系统] 账号数量：{total}")

        if not accounts:
            MAIL_REFRESH_TASK_MANAGER.update(task_id, status="completed")
            MAIL_REFRESH_TASK_MANAGER.log(task_id, "[系统] 没有可取件账号", "warning")
            return

        success = 0
        failed = 0
        for index, account in enumerate(accounts, start=1):
            current = MAIL_REFRESH_TASK_MANAGER.get(task_id)
            if current and current.get("cancel_requested"):
                MAIL_REFRESH_TASK_MANAGER.log(task_id, "[系统] 已取消批量取件", "warning")
                MAIL_REFRESH_TASK_MANAGER.update(task_id, status="cancelled")
                break

            email_addr = (account.get("email") or "").strip().lower()
            MAIL_REFRESH_TASK_MANAGER.log(task_id, f"[{index}/{total}] 开始取件 {email_addr}")
            try:
                fetch_account_inbox(account, skip=0, top=20)
                success += 1
                count = len(get_account_mail_cache(email_addr).get("items", []))
                MAIL_REFRESH_TASK_MANAGER.append_result(task_id, {
                    "email": email_addr,
                    "status": "success",
                    "count": count,
                    "fetch_status": "ok",
                    "fetch_status_label": account_fetch_status_label("ok"),
                })
                MAIL_REFRESH_TASK_MANAGER.log(task_id, f"[{index}/{total}] 完成 {email_addr}，当前缓存 {count} 封", "success")
            except Exception as exc:
                failed += 1
                fetch_status = normalize_account_fetch_status(getattr(exc, "fetch_status", "unknown"))
                update_account_fetch_state(
                    account["id"],
                    fetch_status,
                    str(exc),
                    http_status=getattr(exc, "http_status", None),
                    official_error=getattr(exc, "official_error", None),
                    fetch_step=getattr(exc, "step", None),
                )
                MAIL_REFRESH_TASK_MANAGER.append_result(task_id, {
                    "email": email_addr,
                    "status": "failed",
                    "error": str(exc),
                    "fetch_status": fetch_status,
                    "fetch_status_label": account_fetch_status_label(fetch_status),
                    "http_status": getattr(exc, "http_status", None),
                    "official_error": getattr(exc, "official_error", ""),
                    "step": getattr(exc, "step", ""),
                })
                MAIL_REFRESH_TASK_MANAGER.log(task_id, f"[{index}/{total}] 失败 {email_addr}：{exc}", "error")
            finally:
                MAIL_REFRESH_TASK_MANAGER.update_progress(
                    task_id,
                    total=total,
                    done=index,
                    success=success,
                    failed=failed,
                )
        else:
            final_status = "failed" if failed and success == 0 else "completed"
            final_level = "error" if final_status == "failed" else "success"
            final_error = "全部邮箱取件失败" if final_status == "failed" else ""
            MAIL_REFRESH_TASK_MANAGER.update(task_id, status=final_status, error=final_error)
            MAIL_REFRESH_TASK_MANAGER.log(task_id, f"[系统] 批量取件完成：成功 {success}，失败 {failed}", final_level)


def start_mail_refresh_task(payload: dict[str, Any]) -> str:
    task_id = MAIL_REFRESH_TASK_MANAGER.create(payload)
    MAIL_REFRESH_EXECUTOR.submit(run_mail_refresh_task, task_id)
    return task_id

@app.route("/login", methods=["GET", "POST"])
def login_page():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        password = (data.get("password") or "").strip()
        if verify_password(password, get_setting("login_password_hash")):
            session["logged_in"] = True
            session.permanent = True
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "密码错误"})
    if session.get("logged_in"):
        return redirect(url_for("register_page"))
    return render_template("login.html")


@app.route("/logout")
def logout_page():
    session.clear()
    return redirect(url_for("login_page"))


@app.route("/")
@login_required
def root_page():
    return redirect(url_for("register_page"))


@app.route("/register")
@login_required
def register_page():
    return render_template("register.html")


@app.route("/mail")
@login_required
def mail_page():
    return render_template("mail.html")


@app.route("/settings")
@login_required
def settings_page():
    return render_template("settings.html")


@app.route("/api/dashboard/bootstrap")
@login_required
def api_bootstrap():
    groups = load_groups()
    accounts = load_accounts()
    account_summaries = [{k: v for k, v in acc.items() if k not in {"password", "access_token"}} for acc in accounts]
    return jsonify({
        "success": True,
        "groups": groups,
        "proxy_profiles": load_proxy_profiles(),
        "model_profiles": load_model_profiles(enabled_only=False),
        "accounts": account_summaries,
        "recent_accounts": account_summaries[:10],
        "settings": {
            "default_register_domain": get_setting("default_register_domain", TUTA_FREE_DOMAINS[0]),
            "external_api_key": get_setting("external_api_key", ""),
            "captcha_settings": get_captcha_settings(),
            "captcha_settings_defaults": captcha_setting_defaults(),
        },
        "domains": TUTA_FREE_DOMAINS,
        "group_proxy_map": {str(group["id"]): int(get_setting(f"group_proxy_profile_{group['id']}", "1") or "1") for group in groups},
    })


@app.route("/api/groups", methods=["GET"])
@login_required
def api_get_groups():
    return jsonify({"success": True, "groups": load_groups()})


@app.route("/api/groups", methods=["POST"])
@login_required
def api_create_group():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    color = (data.get("color") or "#3f6fd9").strip() or "#3f6fd9"
    if not name:
        return jsonify({"success": False, "error": "分组名称不能为空"})
    try:
        cur = db_execute("INSERT INTO groups (name, description, color) VALUES (?, ?, ?)", (name, description, color))
        group_id = cur.lastrowid
        set_setting(f"group_proxy_profile_{group_id}", str(int(data.get("proxy_profile_id") or 1)))
        return jsonify({"success": True, "group_id": group_id})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "分组名称已存在"})


@app.route("/api/groups/<int:group_id>", methods=["PUT"])
@login_required
def api_update_group(group_id: int):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    color = (data.get("color") or "#3f6fd9").strip() or "#3f6fd9"
    if not name:
        return jsonify({"success": False, "error": "分组名称不能为空"})
    try:
        db_execute("UPDATE groups SET name = ?, description = ?, color = ? WHERE id = ?", (name, description, color, group_id))
        set_setting(f"group_proxy_profile_{group_id}", str(int(data.get("proxy_profile_id") or 1)))
        return jsonify({"success": True})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "分组名称已存在"})


@app.route("/api/groups/<int:group_id>", methods=["DELETE"])
@login_required
def api_delete_group(group_id: int):
    if group_id == 1:
        return jsonify({"success": False, "error": "默认分组不可删除"})
    db_execute("UPDATE accounts SET group_id = 1, updated_at = ? WHERE group_id = ?", (utc_now(), group_id))
    db_execute("DELETE FROM groups WHERE id = ?", (group_id,))
    return jsonify({"success": True})


@app.route("/api/proxy-profiles", methods=["GET"])
@login_required
def api_get_proxy_profiles():
    return jsonify({"success": True, "proxy_profiles": load_proxy_profiles()})


@app.route("/api/proxy-profiles", methods=["POST"])
@login_required
def api_create_proxy_profile():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "error": "代理名称不能为空"})
    try:
        payload = normalize_proxy_profile_payload(data)
        cur = db_execute("""
            INSERT INTO proxy_profiles (name, mode, proxy_url, dynamic_proxy_url, dynamic_proxy_protocol, enabled, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            name,
            payload["mode"],
            payload["proxy_url"],
            payload["dynamic_proxy_url"],
            payload["dynamic_proxy_protocol"],
            payload["enabled"],
            utc_now(),
        ))
        return jsonify({"success": True, "proxy_profile_id": cur.lastrowid})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "代理名称已存在"})


@app.route("/api/proxy-profiles/<int:profile_id>", methods=["PUT"])
@login_required
def api_update_proxy_profile(profile_id: int):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "error": "代理名称不能为空"})
    try:
        payload = normalize_proxy_profile_payload(data)
        db_execute("""
            UPDATE proxy_profiles
            SET name = ?, mode = ?, proxy_url = ?, dynamic_proxy_url = ?, dynamic_proxy_protocol = ?, enabled = ?, updated_at = ?
            WHERE id = ?
        """, (
            name,
            payload["mode"],
            payload["proxy_url"],
            payload["dynamic_proxy_url"],
            payload["dynamic_proxy_protocol"],
            payload["enabled"],
            utc_now(),
            profile_id,
        ))
        return jsonify({"success": True})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "代理名称已存在"})


@app.route("/api/proxy-profiles/<int:profile_id>", methods=["DELETE"])
@login_required
def api_delete_proxy_profile(profile_id: int):
    if profile_id == 1:
        return jsonify({"success": False, "error": "默认配置不可删除"})
    db_execute("DELETE FROM proxy_profiles WHERE id = ?", (profile_id,))
    return jsonify({"success": True})


@app.route("/api/proxy-profiles/validate", methods=["POST"])
@login_required
def api_validate_proxy_profile():
    data = request.get_json() or {}
    try:
        payload = normalize_proxy_profile_payload(data)
        if payload["mode"] == "none":
            return jsonify({
                "success": True,
                "mode": "none",
                "message": "当前为不使用代理，无需验证",
                "resolved_proxy": "",
                "latency_ms": 0,
            })

        if payload["mode"] == "fixed":
            resolved_proxy = payload["proxy_url"]
        else:
            resolved_proxy = tuta_mod._fetch_dynamic_proxy(
                payload["dynamic_proxy_url"],
                payload["dynamic_proxy_protocol"],
            )
            resolved_proxy = normalize_fixed_proxy_url(resolved_proxy)

        status, _data, elapsed_ms = test_proxy_connectivity(resolved_proxy)
        if status != 200:
            return jsonify({
                "success": False,
                "error": f"代理连通测试失败，Tuta 接口状态码 {status}",
                "resolved_proxy": resolved_proxy,
                "latency_ms": elapsed_ms,
            }), 400

        return jsonify({
            "success": True,
            "mode": payload["mode"],
            "message": "代理可用，已成功连接到 Tuta 接口",
            "resolved_proxy": resolved_proxy,
            "latency_ms": elapsed_ms,
            "normalized": payload,
        })
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/api/model-profiles", methods=["GET"])
@login_required
def api_get_model_profiles():
    return jsonify({"success": True, "model_profiles": load_model_profiles(enabled_only=False)})


@app.route("/api/model-profiles", methods=["POST"])
@login_required
def api_create_model_profile():
    data = request.get_json() or {}
    try:
        payload = normalize_model_profile_payload(data)
        cur = db_execute("""
            INSERT INTO model_profiles (name, api_key_enc, base_url, model_name, priority, enabled, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            payload["name"],
            encrypt_value(payload["api_key"]),
            payload["base_url"],
            payload["model_name"],
            payload["priority"],
            payload["enabled"],
            utc_now(),
        ))
        return jsonify({"success": True, "model_profile_id": cur.lastrowid})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "模型名称已存在"})


@app.route("/api/model-profiles/<int:profile_id>", methods=["PUT"])
@login_required
def api_update_model_profile(profile_id: int):
    data = request.get_json() or {}
    try:
        payload = normalize_model_profile_payload(data)
        db_execute("""
            UPDATE model_profiles
            SET name = ?, api_key_enc = ?, base_url = ?, model_name = ?, priority = ?, enabled = ?, updated_at = ?
            WHERE id = ?
        """, (
            payload["name"],
            encrypt_value(payload["api_key"]),
            payload["base_url"],
            payload["model_name"],
            payload["priority"],
            payload["enabled"],
            utc_now(),
            profile_id,
        ))
        return jsonify({"success": True})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "模型名称已存在"})


@app.route("/api/model-profiles/<int:profile_id>", methods=["DELETE"])
@login_required
def api_delete_model_profile(profile_id: int):
    db_execute("DELETE FROM model_profiles WHERE id = ?", (profile_id,))
    return jsonify({"success": True})


@app.route("/api/model-profiles/validate", methods=["POST"])
@login_required
def api_validate_model_profile():
    data = request.get_json() or {}
    try:
        payload = normalize_model_profile_payload(data)
        validate_mode = (data.get("validate_mode") or "vision").strip().lower()
        result = test_model_profile(payload, validate_mode=validate_mode)
        mode_label = "视觉" if result["mode"] == "vision" else "文本"
        return jsonify({
            "success": True,
            "message": f"模型可用，已成功完成一次{mode_label}验证请求",
            "mode": result["mode"],
            "chat_url": result["chat_url"],
            "latency_ms": result["latency_ms"],
            "response_preview": result["response_preview"],
            "sample_source": result.get("sample_source", ""),
        })
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

@app.route("/api/accounts", methods=["GET"])
@login_required
def api_get_accounts():
    group_id = request.args.get("group_id", type=int)
    accounts = load_accounts(group_id)
    return jsonify({"success": True, "accounts": [{k: v for k, v in acc.items() if k not in {"password", "access_token"}} for acc in accounts]})


@app.route("/api/accounts", methods=["POST"])
@login_required
def api_add_accounts():
    data = request.get_json() or {}
    direct_email = (data.get("email") or "").strip()
    direct_password = (data.get("password") or "").strip()
    group_id = int(data.get("group_id") or 1)
    if direct_email and direct_password:
        account_id = upsert_account(
            direct_email,
            direct_password,
            (data.get("client_id") or "").strip(),
            group_id,
            (data.get("remark") or "").strip(),
            (data.get("access_token") or "").strip(),
            (data.get("user_id") or "").strip(),
        )
        saved_account = load_account(account_id=account_id)
        if saved_account:
            sync_account_meta_core(account_id, saved_account)
        return jsonify({
            "success": True,
            "message": "账号已保存",
            "account_id": account_id,
            "imported": 1,
            "failed": 0,
            "errors": [],
            "items": [{"email": direct_email, "status": "saved", "account_id": account_id}],
        })

    account_string = data.get("account_string", "")
    added = 0
    failed = 0
    errors: list[str] = []
    items: list[dict[str, Any]] = []
    for line_no, raw in enumerate(account_string.splitlines(), start=1):
        raw_line = raw.strip()
        parsed = parse_account_line(raw_line)
        if not parsed:
            if raw_line and not raw_line.startswith("#"):
                failed += 1
                errors.append(f"第 {line_no} 行格式错误：{raw_line}")
                items.append({"line": line_no, "raw": raw_line, "status": "failed", "error": "格式错误"})
            continue
        try:
            account_id = upsert_account(
                parsed["email"],
                parsed["password"],
                parsed.get("client_id"),
                group_id,
                "手动导入",
                parsed.get("access_token", ""),
                parsed.get("user_id", ""),
            )
            saved_account = load_account(account_id=account_id)
            if saved_account:
                sync_account_meta_core(account_id, saved_account)
            added += 1
            items.append({"line": line_no, "email": parsed["email"], "status": "imported", "account_id": account_id})
        except Exception as exc:
            failed += 1
            errors.append(f"第 {line_no} 行导入失败：{parsed['email']} - {exc}")
            items.append({"line": line_no, "email": parsed["email"], "status": "failed", "error": str(exc)})
    if not added:
        return jsonify({
            "success": False,
            "error": "没有成功导入任何账号，格式示例：邮箱----密码----client_id",
            "imported": 0,
            "failed": failed,
            "errors": errors,
            "items": items,
        })
    return jsonify({
        "success": True,
        "message": f"成功导入 {added} 个账号，失败 {failed} 个",
        "imported": added,
        "failed": failed,
        "errors": errors,
        "items": items,
    })


@app.route("/api/accounts/batch-delete", methods=["POST"])
@login_required
def api_batch_delete_accounts():
    data = request.get_json() or {}
    account_ids = [int(item) for item in (data.get("account_ids") or []) if str(item).strip()]
    if not account_ids:
        return jsonify({"success": False, "error": "请选择要删除的账号"})
    deleted = delete_accounts(account_ids)
    return jsonify({"success": True, "deleted": deleted, "message": f"已删除 {deleted} 个账号"})


@app.route("/api/export/verify", methods=["POST"])
@login_required
def api_generate_export_verify_token():
    data = request.get_json() or {}
    password = str(data.get("password") or "")
    if not verify_password(password, get_setting("login_password_hash")):
        return jsonify({"success": False, "error": "登录密码错误"}), 401

    cleanup_export_verify_tokens()
    verify_token = secrets.token_urlsafe(24)
    EXPORT_VERIFY_TOKENS[verify_token] = {
        "created_at": time.time(),
        "expires": time.time() + 300,
    }
    return jsonify({"success": True, "verify_token": verify_token, "expires_in": 300})


@app.route("/api/accounts/export-selected", methods=["POST"])
@login_required
def api_export_selected_accounts():
    data = request.get_json() or {}
    group_ids = [int(item) for item in (data.get("group_ids") or []) if str(item).strip()]
    verify_token = str(data.get("verify_token") or "")
    export_mode = normalize_export_mode(data.get("export_mode"))

    cleanup_export_verify_tokens()
    token_data = EXPORT_VERIFY_TOKENS.get(verify_token)
    if not verify_token or not token_data:
        return jsonify({"success": False, "error": "需要二次验证", "need_verify": True}), 401
    if token_data.get("expires", 0) < time.time():
        EXPORT_VERIFY_TOKENS.pop(verify_token, None)
        return jsonify({"success": False, "error": "验证已过期，请重新输入密码", "need_verify": True}), 401
    EXPORT_VERIFY_TOKENS.pop(verify_token, None)

    if not group_ids:
        return jsonify({"success": False, "error": "请选择要导出的分组"}), 400

    content, total_count, file_ext, mime_type = build_accounts_export_content(group_ids, export_mode=export_mode)
    if not total_count:
        return jsonify({"success": False, "error": "选中的分组下没有邮箱账号"}), 400

    filename = f"tutamail_accounts_{export_mode}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{file_ext}"
    encoded_filename = quote(filename)
    return Response(
        content,
        mimetype=mime_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
    )


@app.route("/api/accounts/<int:account_id>", methods=["GET"])
@login_required
def api_get_account(account_id: int):
    account = load_account(account_id=account_id)
    if not account:
        return jsonify({"success": False, "error": "账号不存在"}), 404
    return jsonify({"success": True, "account": account})


@app.route("/api/accounts/<int:account_id>/probe-status", methods=["POST"])
@login_required
def api_probe_account_status(account_id: int):
    account = load_account(account_id=account_id)
    if not account:
        return jsonify({"success": False, "error": "账号不存在"}), 404
    try:
        result = probe_account_status(account)
        refreshed_account = load_account(account_id=account_id)
        return jsonify({
            "success": True,
            "message": "账号状态已更新",
            "result": result,
            "account": {k: v for k, v in (refreshed_account or {}).items() if k not in {"password", "access_token"}},
        })
    except Exception as exc:
        fetch_status = normalize_account_fetch_status(getattr(exc, "fetch_status", "unknown"))
        update_account_fetch_state(
            account_id,
            fetch_status,
            str(exc),
            http_status=getattr(exc, "http_status", None),
            official_error=getattr(exc, "official_error", None),
            fetch_step=getattr(exc, "step", None),
        )
        return jsonify({
            "success": False,
            "error": str(exc),
            "fetch_status": fetch_status,
            "fetch_status_label": account_fetch_status_label(fetch_status),
            "http_status": getattr(exc, "http_status", None),
            "official_error": getattr(exc, "official_error", ""),
            "step": getattr(exc, "step", ""),
            "can_retry_with_password": bool(getattr(exc, "can_retry_with_password", False)),
        }), 400


@app.route("/api/accounts/<int:account_id>/refresh-session", methods=["POST"])
@login_required
def api_refresh_account_session(account_id: int):
    account = load_account(account_id=account_id)
    if not account:
        return jsonify({"success": False, "error": "账号不存在"}), 404
    try:
        result = refresh_account_session_tokens(account)
        refreshed_account = load_account(account_id=account_id)
        return jsonify({
            "success": True,
            "message": "session/access_token 已刷新",
            "result": {k: v for k, v in result.items() if k != "access_token"},
            "account": {k: v for k, v in (refreshed_account or {}).items() if k not in {"password", "access_token"}},
        })
    except Exception as exc:
        fetch_status = normalize_account_fetch_status(getattr(exc, "fetch_status", "unknown"))
        update_account_fetch_state(
            account_id,
            fetch_status,
            str(exc),
            http_status=getattr(exc, "http_status", None),
            official_error=getattr(exc, "official_error", None),
            fetch_step=getattr(exc, "step", None),
        )
        return jsonify({
            "success": False,
            "error": str(exc),
            "fetch_status": fetch_status,
            "fetch_status_label": account_fetch_status_label(fetch_status),
            "http_status": getattr(exc, "http_status", None),
            "official_error": getattr(exc, "official_error", ""),
            "step": getattr(exc, "step", ""),
            "can_retry_with_password": bool(getattr(exc, "can_retry_with_password", False)),
        }), 400


@app.route("/api/accounts/<int:account_id>", methods=["PUT"])
@login_required
def api_update_account(account_id: int):
    data = request.get_json() or {}
    email_addr = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    if not email_addr or not password:
        return jsonify({"success": False, "error": "邮箱和密码不能为空"})
    try:
        db_execute("""
            UPDATE accounts
            SET email = ?, password_enc = ?, client_id = ?, access_token_enc = ?, user_id = ?, group_id = ?, remark = ?, status = ?, fetch_status = 'unknown',
                last_http_status = NULL, last_official_error = '', last_fetch_step = '', session_refreshed_at = NULL, last_error = '', updated_at = ?
            WHERE id = ?
        """, (
            email_addr,
            encrypt_value(password),
            (data.get("client_id") or "").strip(),
            encrypt_value((data.get("access_token") or "").strip()),
            (data.get("user_id") or "").strip(),
            int(data.get("group_id") or 1),
            (data.get("remark") or "").strip(),
            (data.get("status") or "active").strip(),
            utc_now(),
            account_id,
        ))
        saved_account = load_account(account_id=account_id)
        if saved_account:
            sync_account_meta_core(account_id, saved_account)
        return jsonify({"success": True})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "邮箱已存在"})


@app.route("/api/accounts/<int:account_id>", methods=["DELETE"])
@login_required
def api_delete_account(account_id: int):
    return jsonify({"success": delete_account(account_id)})


@app.route("/api/emails/<path:email_addr>")
@login_required
def api_get_emails(email_addr: str):
    folder = (request.args.get("folder") or "inbox").strip().lower()
    skip = max(int(request.args.get("skip", 0) or 0), 0)
    top = min(max(int(request.args.get("top", 20) or 20), 1), 50)
    force_refresh = (request.args.get("refresh") or "").strip().lower() in {"1", "true", "yes", "on"}
    if folder != "inbox":
        return jsonify({"success": False, "error": "当前版本仅支持收件箱 inbox"}), 400
    account = load_account(email=email_addr)
    if not account:
        return jsonify({"success": False, "error": "账号不存在"}), 404
    try:
        if force_refresh:
            result = fetch_account_inbox(account, skip=skip, top=top)
            source = "live"
        else:
            cache_data = get_account_mail_cache(email_addr)
            cached_items = cache_data.get("items", [])
            result = {
                "emails": cached_items[skip: skip + top],
                "has_more": len(cached_items) > skip + top,
                "method": "Tuta Inbox Cache" if cached_items else "Tuta Inbox",
            }
            source = "cache" if cached_items else "empty"
        emails = [{
            "id": item["id"],
            "subject": item["subject"],
            "from": item["from"],
            "to": item.get("to", ""),
            "date": item["date"],
            "date_display": item.get("date_display", ""),
            "body_preview": item["body_preview"],
        } for item in result["emails"]]
        return jsonify({"success": True, "emails": emails, "has_more": result["has_more"], "method": result["method"], "source": source, "has_cache": source != "empty"})
    except Exception as exc:
        fetch_status = normalize_account_fetch_status(getattr(exc, "fetch_status", "unknown"))
        update_account_fetch_state(
            account["id"],
            fetch_status,
            str(exc),
            http_status=getattr(exc, "http_status", None),
            official_error=getattr(exc, "official_error", None),
            fetch_step=getattr(exc, "step", None),
        )
        return jsonify({
            "success": False,
            "error": str(exc),
            "fetch_status": fetch_status,
            "fetch_status_label": account_fetch_status_label(fetch_status),
            "http_status": getattr(exc, "http_status", None),
            "official_error": getattr(exc, "official_error", ""),
            "step": getattr(exc, "step", ""),
            "can_retry_with_password": bool(getattr(exc, "can_retry_with_password", False)),
        })


@app.route("/api/email/<path:email_addr>/<path:mail_id>")
@login_required
def api_get_email_detail(email_addr: str, mail_id: str):
    account = load_account(email=email_addr)
    if not account:
        return jsonify({"success": False, "error": "账号不存在"}), 404
    detail = get_cached_mail_detail(email_addr, mail_id)
    if detail is None:
        try:
            fetch_account_inbox(account, skip=0, top=50)
            detail = get_cached_mail_detail(email_addr, mail_id)
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)})
    if detail is None:
        return jsonify({"success": False, "error": "未找到邮件详情"}), 404
    return jsonify({"success": True, "email": detail})


@app.route("/api/registration/start", methods=["POST"])
@login_required
def api_start_registration():
    data = request.get_json() or {}
    payload = {
        "batch_count": int(data.get("batch_count") or 1),
        "max_workers": int(data.get("max_workers") or 1),
        "mail_domain": (data.get("mail_domain") or TUTA_FREE_DOMAINS[0]).strip(),
        "group_id": int(data.get("group_id") or 1),
        "proxy_profile_id": int(data.get("proxy_profile_id") or 1),
        "model_profile_ids": [int(item) for item in data.get("model_profile_ids", [])],
    }
    if payload["mail_domain"] not in TUTA_FREE_DOMAINS:
        return jsonify({"success": False, "error": "不支持的域名"})
    task_id = start_registration_task(payload)
    set_setting("default_register_domain", payload["mail_domain"])
    return jsonify({"success": True, "task_id": task_id})


@app.route("/api/registration/tasks/<task_id>")
@login_required
def api_get_registration_task(task_id: str):
    task = TASK_MANAGER.get(task_id)
    if not task:
        return jsonify({"success": False, "error": "任务不存在"}), 404
    return jsonify({"success": True, "task": task})


@app.route("/api/registration/tasks/<task_id>/cancel", methods=["POST"])
@login_required
def api_cancel_registration_task(task_id: str):
    task = TASK_MANAGER.get(task_id)
    if not task:
        return jsonify({"success": False, "error": "任务不存在"}), 404
    TASK_MANAGER.update(task_id, cancel_requested=True)
    TASK_MANAGER.log(task_id, "[系统] 已请求取消，当前运行中的子任务完成后停止", "warning")
    return jsonify({"success": True})


@app.route("/api/mail-refresh/start", methods=["POST"])
@login_required
def api_start_mail_refresh():
    data = request.get_json() or {}
    scope = (data.get("scope") or "group").strip().lower()
    group_id = int(data.get("group_id") or 0)
    include_disabled = bool(data.get("include_disabled"))
    account_ids = [int(item) for item in (data.get("account_ids") or []) if int(item) > 0]

    if scope not in {"group", "all", "selected"}:
        return jsonify({"success": False, "error": "不支持的取件范围"}), 400
    if scope == "group":
        if group_id <= 0:
            return jsonify({"success": False, "error": "缺少分组 ID"}), 400
        group = load_group(group_id)
        if not group:
            return jsonify({"success": False, "error": "分组不存在"}), 404
    if scope == "selected":
        if not account_ids:
            return jsonify({"success": False, "error": "缺少账号 ID"}), 400
        accounts = load_accounts_by_ids(account_ids)
        if not accounts:
            return jsonify({"success": False, "error": "所选账号不存在"}), 404

    payload = {
        "scope": scope,
        "group_id": group_id,
        "account_ids": account_ids,
        "include_disabled": include_disabled,
        "batch_count": 1,
    }
    task_id = start_mail_refresh_task(payload)
    return jsonify({"success": True, "task_id": task_id})


@app.route("/api/mail-refresh/tasks/<task_id>")
@login_required
def api_get_mail_refresh_task(task_id: str):
    task = MAIL_REFRESH_TASK_MANAGER.get(task_id)
    if not task:
        return jsonify({"success": False, "error": "任务不存在"}), 404
    return jsonify({"success": True, "task": task})


@app.route("/api/mail-refresh/tasks/<task_id>/cancel", methods=["POST"])
@login_required
def api_cancel_mail_refresh_task(task_id: str):
    task = MAIL_REFRESH_TASK_MANAGER.get(task_id)
    if not task:
        return jsonify({"success": False, "error": "任务不存在"}), 404
    MAIL_REFRESH_TASK_MANAGER.update(task_id, cancel_requested=True)
    MAIL_REFRESH_TASK_MANAGER.log(task_id, "[系统] 已请求取消，当前邮箱处理完成后停止", "warning")
    return jsonify({"success": True})


@app.route("/api/settings", methods=["GET"])
@login_required
def api_get_settings():
    return jsonify({
        "success": True,
        "settings": {
            "external_api_key": get_setting("external_api_key", ""),
            "captcha_settings": get_captcha_settings(),
            "captcha_settings_defaults": captcha_setting_defaults(),
        },
    })


@app.route("/api/settings", methods=["PUT"])
@login_required
def api_update_settings():
    data = request.get_json() or {}
    updated = []
    if "external_api_key" in data:
        set_setting("external_api_key", (data.get("external_api_key") or "").strip())
        updated.append("对外 API Key")
    if "captcha_settings" in data:
        save_captcha_settings(data.get("captcha_settings") or {})
        updated.append("验证码识别配置")
    password = (data.get("login_password") or "").strip()
    if password:
        if len(password) < 8:
            return jsonify({"success": False, "error": "登录密码至少 8 位"})
        set_setting("login_password_hash", hash_password(password))
        updated.append("登录密码")
    return jsonify({"success": True, "message": "，".join(updated) or "没有变更"})


@app.route("/api/settings/captcha/reset", methods=["POST"])
@login_required
def api_reset_captcha_settings():
    settings = reset_captcha_settings()
    return jsonify({"success": True, "settings": settings, "message": "已恢复默认验证码配置"})


@app.route("/api/group-proxy-map", methods=["PUT"])
@login_required
def api_update_group_proxy_map():
    data = request.get_json() or {}
    for group_id, proxy_profile_id in (data.get("group_proxy_map") or {}).items():
        set_setting(f"group_proxy_profile_{int(group_id)}", str(int(proxy_profile_id or 1)))
    return jsonify({"success": True})


@app.route("/api/external/emails")
@external_api_key_required
def api_external_get_emails():
    email_addr = (request.args.get("email") or "").strip()
    folder = (request.args.get("folder") or "inbox").strip().lower()
    skip = max(int(request.args.get("skip", 0) or 0), 0)
    top = min(max(int(request.args.get("top", 20) or 20), 1), 50)
    if not email_addr:
        return jsonify({"success": False, "error": "缺少 email 参数"}), 400
    if folder != "inbox":
        return jsonify({"success": False, "error": "当前仅支持 inbox"}), 400
    account = load_account(email=email_addr)
    if not account:
        return jsonify({"success": False, "error": "邮箱账号不存在"}), 404
    try:
        result = fetch_account_inbox(account, skip=skip, top=top)
        emails = [{"id": item["id"], "subject": item["subject"], "from": item["from"], "date": item["date"], "body_preview": item["body_preview"]} for item in result["emails"]]
        return jsonify({"success": True, "emails": emails, "has_more": result["has_more"], "method": result["method"]})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


init_db()
log_app("Tutamail application initialized")


def serve_app() -> None:
    host = (os.getenv("TUTAMAIL_HOST") or "127.0.0.1").strip() or "127.0.0.1"
    port = int(os.getenv("TUTAMAIL_PORT") or "5100")
    threads = max(4, int(os.getenv("TUTAMAIL_THREADS") or "8"))
    from waitress import serve

    log_app(f"Tutamail starting with waitress on {host}:{port}, threads={threads}")
    serve(app, host=host, port=port, threads=threads)


if __name__ == "__main__":
    serve_app()
