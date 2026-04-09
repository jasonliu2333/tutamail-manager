import argparse
import json
import math
import os
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np


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
    # 图像坐标 y 向下，转为 y 向上
    dy_up = -dy
    deg = math.degrees(math.atan2(dy_up, dx)) % 360  # 0=右, 90=上
    clock_deg = (90 - deg) % 360  # 0=12点方向
    return clock_deg


def detect_clock_hands(image_path: str) -> Dict[str, Any]:
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
            # 过滤：较长、靠近圆心的线段更可能是指针
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

    def ang_dist(a: float, b: float) -> float:
        d = abs(a - b) % 360
        return min(d, 360 - d)

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
                # 分针应更长
                if minute_c["length"] < hour_c["length"]:
                    continue

                minute_raw = minute_c["angle_clock"]
                # 分针只取 0,5,10,...,55
                minute = int(round((minute_raw / 6.0) / 5.0) * 5) % 60
                minute_angle = minute * 6.0
                minute_err = ang_dist(minute_raw, minute_angle)

                hour_raw = hour_c["angle_clock"]
                hour = int(round((hour_raw - minute * 0.5) / 30.0)) % 12
                hour = 12 if hour == 0 else hour
                hour_angle = (hour % 12) * 30.0 + minute * 0.5
                hour_err = ang_dist(hour_raw, hour_angle)

                # 长度比越大越可信
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
        "size": [width, height],
        "center": [int(center[0]), int(center[1])],
        "radius": int(radius),
        "num_lines": 0 if lines is None else int(len(lines)),
        "candidates": candidates,
        "pred_time": pred_time,
        "pred_score": pred_score,
        "chosen_pair": chosen_pair,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="OpenCV 时钟验证码识别测试")
    parser.add_argument("--dir", default="captchas", help="图片目录（默认 captchas）")
    parser.add_argument("--out", default="captchas/opencv_results.json", help="输出 JSON 文件")
    parser.add_argument("--max", type=int, default=0, help="最多处理多少张，0=全部")
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
    for path in images:
        res = detect_clock_hands(path)
        results.append(res)
        print(f"- {res.get('image')} -> pred_time={res.get('pred_time')}, lines={res.get('num_lines')}")

    out_path = args.out
    if not os.path.isabs(out_path):
        out_path = os.path.join(os.getcwd(), out_path)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n已写入结果: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
