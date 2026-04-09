import base64
import json
import os
import re
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import urllib.request


BASE_URL = os.getenv("GROK_BASE_URL", "https://grok.ksxuemm.serv00.net/v1")
API_KEY = os.getenv("GROK_API_KEY", "").strip()
MODEL = os.getenv("GROK_MODEL", "gpt-5.2")


@dataclass
class TestCase:
    name: str
    path: str
    expected_time: str


TEST_CASES: List[TestCase] = [
    TestCase("cap5", "captcha_1_cap5_1774707345.png", "04:05"),
    TestCase("cap6", "captcha_1_cap6_1774707737.png", "11:25"),
    TestCase("cookie", "captcha_1_cookie_1774707650.png", "11:15"),
]


def read_b64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


def extract_json(text: str) -> Dict[str, Any]:
    if not text:
        raise ValueError("Empty model response")
    text = text.strip()
    # Try direct JSON first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Fallback: extract first JSON object
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError(f"No JSON object found in response: {text[:200]}")
    return json.loads(m.group(0))


def chat(messages: List[Dict[str, Any]], timeout: int = 60) -> str:
    if not API_KEY:
        raise RuntimeError("Missing API key. Set GROK_API_KEY env var.")
    url = f"{BASE_URL.rstrip('/')}/chat/completions"
    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0,
        "max_tokens": 200,
    }
    headers = {
        "Authorization": f"Bearer {API_KEY}",
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


def classify_day_night(image_b64: str) -> Tuple[str, float]:
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
    text = chat(messages)
    obj = extract_json(text)
    day_night = str(obj.get("day_night", "")).lower().strip()
    conf = float(obj.get("confidence", 0))
    if day_night not in ("day", "night"):
        raise ValueError(f"Invalid day_night: {day_night}")
    return day_night, conf


def read_time(image_b64: str, day_night: str) -> str:
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
    text = chat(messages)
    obj = extract_json(text)
    time_str = str(obj.get("time", "")).strip()
    if not re.match(r"^\d{2}:\d{2}$", time_str):
        raise ValueError(f"Invalid time format: {time_str}")
    return time_str


def run_two_step(test: TestCase) -> Dict[str, Any]:
    image_b64 = read_b64(test.path)
    day_night, conf = classify_day_night(image_b64)
    time_str = read_time(image_b64, day_night)
    return {
        "name": test.name,
        "day_night": day_night,
        "day_night_conf": conf,
        "time": time_str,
        "expected": test.expected_time,
        "correct": time_str == test.expected_time,
    }


def print_summary(results: List[Dict[str, Any]]) -> None:
    correct = sum(1 for r in results if r["correct"])
    total = len(results)
    acc = correct / total if total else 0
    print("Two-step results:")
    for r in results:
        print(
            f"- {r['name']}: day_night={r['day_night']}({r['day_night_conf']:.2f}) "
            f"time={r['time']} expected={r['expected']} correct={r['correct']}"
        )
    print(f"Accuracy: {correct}/{total} = {acc:.2%}")


def main() -> int:
    missing = [t.path for t in TEST_CASES if not os.path.exists(t.path)]
    if missing:
        print(f"Missing files: {missing}")
        return 2
    results = []
    for t in TEST_CASES:
        try:
            results.append(run_two_step(t))
        except Exception as e:
            print(f"Error on {t.name}: {e}")
            return 1
    print_summary(results)
    return 0


if __name__ == "__main__":
    sys.exit(main())
