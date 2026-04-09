import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple


def _load_config() -> Dict[str, Any]:
    config = {
        "captcha_auto": False,
        "captcha_api_key": "",
        "captcha_base_url": "https://grok.ksxuemm.serv00.net/v1",
        "captcha_model": "gpt-5.2",
    }
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                file_config = json.load(f)
                config.update(file_config)
        except Exception as e:
            print(f"⚠️ 加载 config.json 失败: {e}")
    return config


CONFIG = _load_config()


@dataclass
class Label:
    name: str
    path: str
    expected_time: str


def _read_b64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


class CaptchaTimeSolver:
    BASE_URL = CONFIG.get("captcha_base_url", "https://grok.ksxuemm.serv00.net/v1")
    API_KEY = str(CONFIG.get("captcha_api_key", "")).strip()
    MODEL = CONFIG.get("captcha_model", "gpt-5.2")

    @classmethod
    def _extract_json(cls, text: str) -> Dict[str, Any]:
        if not text:
            raise ValueError("Empty model response")
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise ValueError(f"No JSON object found in response: {text[:200]}")
        return json.loads(m.group(0))

    @classmethod
    def _chat(cls, messages, timeout: int = 60) -> str:
        api_key = str(CONFIG.get("captcha_api_key", cls.API_KEY)).strip()
        if not api_key:
            raise RuntimeError("Missing API key. Set captcha_api_key in config.json.")
        base_url = CONFIG.get("captcha_base_url", cls.BASE_URL)
        model = CONFIG.get("captcha_model", cls.MODEL)
        url = f"{base_url.rstrip('/')}/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0,
            "max_tokens": 200,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                resp_body = resp.read().decode("utf-8")
                if resp.status != 200:
                    raise RuntimeError(f"HTTP {resp.status}: {resp_body}")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"HTTP {e.code}: {body}") from e
        data = json.loads(resp_body)
        return data["choices"][0]["message"]["content"]

    @classmethod
    def _classify_day_night(cls, image_b64: str):
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a captcha visual inspector. Only classify day or night. "
                    "Reply with strict JSON: {\"day_night\":\"day|night\",\"confidence\":0-1}."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Classify this image as day or night. JSON only."},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
                ],
            },
        ]
        text = cls._chat(messages)
        obj = cls._extract_json(text)
        day_night = str(obj.get("day_night", "")).lower().strip()
        conf = float(obj.get("confidence", 0))
        if day_night not in ("day", "night"):
            raise ValueError(f"Invalid day_night: {day_night}")
        return day_night, conf

    @classmethod
    def _read_time(cls, image_b64: str, day_night: str) -> str:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a captcha clock reader. Given day/night, read the clock hands. "
                    "Reply with strict JSON: {\"time\":\"HH:MM\"} in 24-hour format."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"Day/night: {day_night}. Read the clock hands and output time. JSON only."
                        ),
                    },
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
                ],
            },
        ]
        text = cls._chat(messages)
        obj = cls._extract_json(text)
        time_str = str(obj.get("time", "")).strip()
        if not re.match(r"^\d{2}:\d{2}$", time_str):
            raise ValueError(f"Invalid time format: {time_str}")
        return time_str

    @classmethod
    def solve_time(cls, image_b64: str) -> Tuple[str, str, float]:
        day_night, conf = cls._classify_day_night(image_b64)
        time_str = cls._read_time(image_b64, day_night)
        return time_str, day_night, conf


def _load_labels(path: str) -> List[Label]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "items" in data:
        data = data["items"]
    if not isinstance(data, list):
        raise ValueError("labels 文件格式错误，应为列表或包含 items 字段")
    labels: List[Label] = []
    base_dir = os.path.dirname(os.path.abspath(path))
    for i, item in enumerate(data, 1):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or f"case_{i}")
        rel_path = item.get("path")
        expected = item.get("expected_time")
        if not rel_path or not expected:
            continue
        if not os.path.isabs(rel_path):
            rel_path = os.path.join(base_dir, rel_path)
        labels.append(Label(name=name, path=rel_path, expected_time=str(expected)))
    return labels


def run_eval(labels: List[Label], repeat: int = 1, timeout: int = 60) -> int:
    total = 0
    correct = 0
    per_label = []
    for label in labels:
        if not os.path.exists(label.path):
            print(f"Missing file: {label.path}")
            continue
        image_b64 = _read_b64(label.path)
        label_correct = 0
        label_total = 0
        for r in range(repeat):
            label_total += 1
            total += 1
            try:
                t, day_night, conf = CaptchaTimeSolver.solve_time(image_b64)
                ok = (t == label.expected_time)
                if ok:
                    correct += 1
                    label_correct += 1
                print(
                    f"- {label.name} [{r+1}/{repeat}] "
                    f"pred={t} expected={label.expected_time} "
                    f"day_night={day_night} conf={conf:.2f} ok={ok}"
                )
            except Exception as e:
                print(f"- {label.name} [{r+1}/{repeat}] error: {e}")
        per_label.append((label.name, label_correct, label_total))
        time.sleep(0.1)
    if total:
        acc = correct / total
        print(f"\nOverall accuracy: {correct}/{total} = {acc:.2%}")
    else:
        print("\nNo valid samples.")
    if per_label:
        print("\nPer-label accuracy:")
        for name, c, t in per_label:
            rate = (c / t) if t else 0
            print(f"- {name}: {c}/{t} = {rate:.2%}")
    return 0 if total else 2


def main() -> int:
    parser = argparse.ArgumentParser(description="Tuta captcha 识别成功率测试")
    parser.add_argument(
        "--labels",
        default=os.path.join("captchas", "labels.json"),
        help="标注文件路径（默认 captchas/labels.json）",
    )
    parser.add_argument("--repeat", type=int, default=1, help="每张图重复测试次数")
    parser.add_argument("--timeout", type=int, default=60, help="单次请求超时秒数")
    args = parser.parse_args()

    labels_path = args.labels
    if not os.path.isabs(labels_path):
        labels_path = os.path.join(os.getcwd(), labels_path)
    labels = _load_labels(labels_path)
    if not labels:
        print("labels 为空，请先标注 captchas/labels.json")
        return 2
    return run_eval(labels, repeat=max(1, args.repeat), timeout=args.timeout)


if __name__ == "__main__":
    sys.exit(main())
