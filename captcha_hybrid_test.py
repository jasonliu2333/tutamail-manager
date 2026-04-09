import argparse
import base64
import json
import math
import os
import re
import sys
import time
import urllib.request
import urllib.error
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np


def _load_config() -> Dict[str, Any]:
    config = {
        "captcha_api_key": "",
        "captcha_base_url": "https://grok.ksxuemm.serv00.net/v1",
        "captcha_model": "gpt-5.2",
        "vision_enabled": True,
        "vision_api_key": "",
        "vision_base_url": "",
        "vision_model": "",
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


def _list_images(root: str) -> List[str]:
    exts = {".png", ".jpg", ".jpeg", ".bmp"}
    files = []
    for name in os.listdir(root):
        path = os.path.join(root, name)
        if not os.path.isfile(path):
            continue
        _, ext = os.path.splitext(name.lower())
        if ext in exts:
            files.append(path)
    files.sort()
    return files


def _detect_clock(img: np.ndarray) -> Tuple[Tuple[int, int], int]:
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=100,
        param1=50,
        param2=30,
        minRadius=min(w, h) // 4,
        maxRadius=min(w, h) // 2,
    )
    if circles is not None and len(circles) > 0:
        circles = np.uint16(np.around(circles))
        x, y, r = circles[0][0]
        return (int(x), int(y)), int(r)
    return (w // 2, h // 2), min(w, h) // 2


def _angle_clock(center: Tuple[int, int], tip: Tuple[int, int]) -> float:
    cx, cy = center
    tx, ty = tip
    dx = tx - cx
    dy = ty - cy
    dy_up = -dy
    deg = math.degrees(math.atan2(dy_up, dx)) % 360
    return (90 - deg) % 360


def _ang_dist(a: float, b: float) -> float:
    d = abs(a - b) % 360
    return min(d, 360 - d)


def _opencv_detect(image_path: str) -> Dict[str, Any]:
    img = cv2.imread(image_path)
    if img is None:
        return {"error": "无法读取图片"}

    height, width = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150, apertureSize=3)

    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)
    edges = cv2.erode(edges, kernel, iterations=1)

    center, radius = _detect_clock(img)
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=80,
        minLineLength=max(10, int(radius * 0.3)),
        maxLineGap=20,
    )

    hands = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            length = math.hypot(x2 - x1, y2 - y1)
            d1 = math.hypot(x1 - center[0], y1 - center[1])
            d2 = math.hypot(x2 - center[0], y2 - center[1])
            if length < radius * 0.25:
                continue
            if max(d1, d2) > radius * 1.1:
                continue
            tip = (x1, y1) if d1 > d2 else (x2, y2)
            angle_clock = _angle_clock(center, tip)
            hands.append(
                {
                    "line": [int(x1), int(y1), int(x2), int(y2)],
                    "length": float(length),
                    "angle_clock": float(round(angle_clock, 2)),
                    "center_dist": float(round((d1 + d2) / 2, 2)),
                }
            )

    hands.sort(key=lambda h: h["length"], reverse=True)
    candidates = hands[:6]

    pred_time = None
    pred_score = None
    chosen_pair = None
    if len(candidates) >= 2:
        for i in range(len(candidates)):
            for j in range(len(candidates)):
                if i == j:
                    continue
                minute_c = candidates[i]
                hour_c = candidates[j]
                if minute_c["length"] < hour_c["length"]:
                    continue

                minute_raw = minute_c["angle_clock"]
                minute = int(round((minute_raw / 6.0) / 5.0) * 5) % 60
                minute_angle = minute * 6.0
                minute_err = _ang_dist(minute_raw, minute_angle)

                hour_raw = hour_c["angle_clock"]
                hour = int(round((hour_raw - minute * 0.5) / 30.0)) % 12
                hour = 12 if hour == 0 else hour
                hour_angle = (hour % 12) * 30.0 + minute * 0.5
                hour_err = _ang_dist(hour_raw, hour_angle)

                length_ratio = minute_c["length"] / max(1.0, hour_c["length"])
                length_penalty = 0.0 if length_ratio >= 1.2 else (1.2 - length_ratio) * 10.0

                score = minute_err * 1.2 + hour_err * 1.0 + length_penalty
                if pred_score is None or score < pred_score:
                    pred_score = score
                    pred_time = f"{hour:02d}:{minute:02d}"
                    chosen_pair = {
                        "minute": minute_c,
                        "hour": hour_c,
                        "minute_err": round(minute_err, 2),
                        "hour_err": round(hour_err, 2),
                        "length_ratio": round(length_ratio, 2),
                        "score": round(score, 2),
                    }

    return {
        "image": os.path.basename(image_path),
        "path": image_path,
        "size": [width, height],
        "center": [int(center[0]), int(center[1])],
        "radius": int(radius),
        "num_lines": 0 if lines is None else int(len(lines)),
        "candidates": candidates,
        "pred_time": pred_time,
        "pred_score": pred_score,
        "chosen_pair": chosen_pair,
    }


def _crop_for_vision(img: np.ndarray, center: Tuple[int, int], radius: int, chosen_pair: Dict[str, Any]) -> np.ndarray:
    h, w = img.shape[:2]
    cx, cy = center
    if chosen_pair and chosen_pair.get("minute") and chosen_pair.get("hour"):
        coords = []
        for key in ("minute", "hour"):
            line = chosen_pair[key]["line"]
            coords.append((line[0], line[1]))
            coords.append((line[2], line[3]))
        coords.append((cx, cy))
        xs = [c[0] for c in coords]
        ys = [c[1] for c in coords]
        x1, y1, x2, y2 = min(xs), min(ys), max(xs), max(ys)
        margin = int(radius * 0.35)
    else:
        x1, y1, x2, y2 = cx - radius, cy - radius, cx + radius, cy + radius
        margin = int(radius * 0.1)
    x1 = max(0, x1 - margin)
    y1 = max(0, y1 - margin)
    x2 = min(w - 1, x2 + margin)
    y2 = min(h - 1, y2 + margin)
    crop = img[y1 : y2 + 1, x1 : x2 + 1]
    return crop


def _encode_b64(img: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise RuntimeError("图片编码失败")
    return base64.b64encode(buf.tobytes()).decode("ascii")


def _resize_for_vision(img: np.ndarray, max_side: int = 256, target_size: Tuple[int, int] = None) -> np.ndarray:
    h, w = img.shape[:2]
    if target_size:
        tw, th = target_size
        if tw > 0 and th > 0:
            return cv2.resize(img, (tw, th), interpolation=cv2.INTER_AREA)
    if max_side <= 0:
        return img
    scale = max(h, w) / float(max_side)
    if scale <= 1.0:
        return img
    new_w = int(round(w / scale))
    new_h = int(round(h / scale))
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def _extract_json(text: str) -> Dict[str, Any]:
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


def _vision_chat(messages, timeout: int = 60) -> str:
    api_key = str(CONFIG.get("vision_api_key") or CONFIG.get("captcha_api_key") or "").strip()
    if not api_key:
        raise RuntimeError("Missing API key. Set vision_api_key in config.json.")
    base_url = (
        CONFIG.get("vision_base_url")
        or CONFIG.get("captcha_base_url")
        or "https://grok.ksxuemm.serv00.net/v1"
    )
    model = CONFIG.get("vision_model") or CONFIG.get("captcha_model") or "gpt-5.2"
    url = f"{str(base_url).rstrip('/')}/chat/completions"
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


def _vision_read_time(image_b64: str, hint_time: str = None) -> Dict[str, Any]:
    hint_text = ""
    if hint_time:
        hint_text = f"OpenCV rough time: {hint_time}. "
    messages = [
        {
            "role": "system",
            "content": (
                "You are a captcha clock reader. Given an image, read the clock hands. "
                "Minutes are multiples of 5. "
                "Reply with strict JSON: {\"time\":\"HH:MM\",\"confidence\":0-1} in 12-hour format."
            ),
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        f"{hint_text}Read the clock hands and output time. JSON only."
                    ),
                },
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
            ],
        },
    ]
    text = _vision_chat(messages)
    obj = _extract_json(text)
    time_str = str(obj.get("time", "")).strip()
    conf = float(obj.get("confidence", 0))
    if not re.match(r"^\d{2}:\d{2}$", time_str):
        raise ValueError(f"Invalid time format: {time_str}")
    return {"time": time_str, "confidence": conf}


def _vision_classify_day_night(image_b64: str) -> Dict[str, Any]:
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
    text = _vision_chat(messages)
    obj = _extract_json(text)
    day_night = str(obj.get("day_night", "")).lower().strip()
    conf = float(obj.get("confidence", 0))
    if day_night not in ("day", "night"):
        raise ValueError(f"Invalid day_night: {day_night}")
    return {"day_night": day_night, "confidence": conf}


def _vision_read_time_with_day_night(image_b64: str, day_night: str, hint_time: str = None) -> Dict[str, Any]:
    hint_text = ""
    if hint_time:
        hint_text = f"OpenCV rough time: {hint_time}. "
    messages = [
        {
            "role": "system",
            "content": (
                "You are a captcha clock reader. Given day/night, read the clock hands. "
                "Minutes are multiples of 5. "
                "Reply with strict JSON: {\"time\":\"HH:MM\",\"confidence\":0-1} in 12-hour format."
            ),
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        f"{hint_text}Day/night: {day_night}. "
                        "Treat this as an analog clock. Identify the hour and minute hands and tell the time. "
                        "JSON only."
                    ),
                },
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
            ],
        },
    ]
    text = _vision_chat(messages)
    obj = _extract_json(text)
    time_str = str(obj.get("time", "")).strip()
    conf = float(obj.get("confidence", 0))
    if not re.match(r"^\d{2}:\d{2}$", time_str):
        raise ValueError(f"Invalid time format: {time_str}")
    return {"time": time_str, "confidence": conf}


def main() -> int:
    parser = argparse.ArgumentParser(description="OpenCV + 视觉模型混合识别测试")
    parser.add_argument("--dir", default="captchas", help="图片目录（默认 captchas）")
    parser.add_argument("--out", default="captchas/hybrid_results.json", help="输出 JSON 文件")
    parser.add_argument("--max", type=int, default=0, help="最多处理多少张，0=全部")
    parser.add_argument("--no-vision", action="store_true", help="仅跑 OpenCV，不调用模型")
    parser.add_argument("--probe", action="store_true", help="探测模型接口可用性")
    parser.add_argument("--thumb-dir", default="", help="缩略图输出目录（默认 captchas/_thumbs）")
    args = parser.parse_args()

    img_dir = args.dir
    if not os.path.isabs(img_dir):
        img_dir = os.path.join(os.getcwd(), img_dir)
    if not os.path.isdir(img_dir):
        print(f"目录不存在: {img_dir}")
        return 2

    images = _list_images(img_dir)
    if args.max and args.max > 0:
        images = images[: args.max]
    if not images:
        print("未找到图片")
        return 2

    results = []
    use_vision = CONFIG.get("vision_enabled", True) and (not args.no_vision)
    thumb_dir = args.thumb_dir.strip()
    if not thumb_dir:
        thumb_dir = CONFIG.get("vision_thumb_dir") or os.path.join(img_dir, "_thumbs")
    if not os.path.isabs(thumb_dir):
        thumb_dir = os.path.join(os.getcwd(), thumb_dir)
    save_thumbs = bool(CONFIG.get("vision_save_thumbs", True))
    if save_thumbs:
        os.makedirs(thumb_dir, exist_ok=True)

    if args.probe:
        try:
            _ = _vision_chat(
                [
                    {"role": "system", "content": "You are a test endpoint."},
                    {"role": "user", "content": "ping"},
                ],
                timeout=30,
            )
            print("[Probe] 视觉模型接口可用")
        except Exception as e:
            print(f"[Probe] 视觉模型接口失败: {e}")

    # 读取参考缩略图尺寸（如果配置）
    ref_path = str(CONFIG.get("vision_resize_ref") or "").strip()
    if ref_path:
        if not os.path.isabs(ref_path):
            ref_path = os.path.join(os.getcwd(), ref_path)
        if os.path.exists(ref_path):
            ref_img = cv2.imread(ref_path)
            if ref_img is not None:
                ref_h, ref_w = ref_img.shape[:2]
                CONFIG["vision_resize_width"] = int(ref_w)
                CONFIG["vision_resize_height"] = int(ref_h)

    for path in images:
        base = _opencv_detect(path)
        img = cv2.imread(path)
        if img is None:
            base["error"] = "无法读取图片"
            results.append(base)
            print(f"- {base.get('image')} -> error")
            continue
        center = (base["center"][0], base["center"][1])
        crop_mode = str(CONFIG.get("vision_crop_mode") or "auto").lower().strip()
        if crop_mode == "full":
            crop = img
        else:
            crop = _crop_for_vision(img, center, base["radius"], base.get("chosen_pair"))
        resize_enabled = bool(CONFIG.get("vision_resize_enabled", True))
        max_side = int(CONFIG.get("vision_resize_max", 256) or 256)
        target_w = int(CONFIG.get("vision_resize_width", 0) or 0)
        target_h = int(CONFIG.get("vision_resize_height", 0) or 0)
        target_size = (target_w, target_h) if target_w > 0 and target_h > 0 else None
        if resize_enabled:
            crop = _resize_for_vision(crop, max_side=max_side, target_size=target_size)
        crop_b64 = _encode_b64(crop)
        base["crop_size"] = [int(crop.shape[1]), int(crop.shape[0])]
        base["crop_mode"] = crop_mode
        base["resize_target"] = [int(target_w), int(target_h)] if target_size else None
        if save_thumbs:
            thumb_name = os.path.splitext(os.path.basename(path))[0] + "_thumb.png"
            thumb_path = os.path.join(thumb_dir, thumb_name)
            cv2.imwrite(thumb_path, crop)
            base["thumb_path"] = thumb_path

        if use_vision:
            try:
                day = _vision_classify_day_night(crop_b64)
                base["vision_day_night"] = day.get("day_night")
                base["vision_day_night_confidence"] = day.get("confidence")
                vis = _vision_read_time_with_day_night(
                    crop_b64,
                    day_night=base.get("vision_day_night"),
                    hint_time=base.get("pred_time"),
                )
                base["vision_time"] = vis.get("time")
                base["vision_confidence"] = vis.get("confidence")
            except Exception as e:
                base["vision_error"] = str(e)

        results.append(base)
        print(
            f"- {base.get('image')} -> opencv={base.get('pred_time')}, "
            f"vision={base.get('vision_time')}"
        )
        time.sleep(0.2)

    out_path = args.out
    if not os.path.isabs(out_path):
        out_path = os.path.join(os.getcwd(), out_path)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n已写入结果: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
