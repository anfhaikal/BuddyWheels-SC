import os
import pickle
import time
import urllib.request
from collections import deque, Counter
from datetime import datetime

import face_recognition
import numpy as np


def draw_text_bg(img, text, org, font=None,
                 font_scale=0.6, color=(20, 20, 20), bg_color=(255, 255, 255), thickness=1,
                 pad=8, border_color=None):
    """
    Draw text with a solid background box for legibility.
    Defaults use a white background and dark text for a modern look.
    If border_color is provided (B,G,R), a 1px border will be drawn around the box.
    """
    # Delay import of cv2 until runtime to avoid import-time costs in callers
    import cv2
    if font is None:
        font = cv2.FONT_HERSHEY_SIMPLEX
    (w, h), _ = cv2.getTextSize(text, font, font_scale, thickness)
    x, y = org
    x0 = x - pad // 2
    y0 = y - h - pad // 2
    x1 = x + w + pad // 2
    y1 = y + pad // 2
    cv2.rectangle(img, (x0, y0), (x1, y1), bg_color, -1)
    if border_color is not None:
        cv2.rectangle(img, (x0, y0), (x1, y1), border_color, 1)
    cv2.putText(img, text, org, font or cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, thickness, cv2.LINE_AA)


def read_last_attendance(n=5, attendance_log='attendance.csv'):
    lines = []
    if not os.path.exists(attendance_log):
        return lines
    try:
        with open(attendance_log, 'r', encoding='utf-8') as f:
            all_lines = f.readlines()
            lines = [l.strip() for l in all_lines[-n:]]
    except Exception:
        pass
    return lines


def mark_attendance(name, attendance_log='attendance.csv'):
    try:
        with open(attendance_log, "a", encoding='utf-8') as f:
            now = datetime.now()
            timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"{name},{timestamp}\n")
            print(f"[LOG] {name} marked present at {timestamp}")
    except Exception as e:
        print(f"[WARN] Failed to write attendance for {name}: {e}")


def load_known_faces(known_faces_dir="known_faces", encodings_cache=None):
    """
    Load known face encodings from cache if available; otherwise build them from
    images in `known_faces_dir`. If Firestore/Storage are configured, attempt a
    one-time download of images when the cache is missing.

    Returns (known_encodings, known_names)
    """
    if encodings_cache is None:
        encodings_cache = os.path.join(known_faces_dir, "encodings.pickle")

    known_encodings = []
    known_names = []

    print("[INFO] Loading known faces...")

    if os.path.exists(encodings_cache):
        try:
            with open(encodings_cache, "rb") as f:
                data = pickle.load(f)
                known_encodings = data.get("encodings", [])
                known_names = data.get("names", [])
            print(f"[INFO] Loaded {len(known_names)} faces from cache: {known_names}")
            try:
                current_files = [os.path.splitext(fn)[0] for fn in os.listdir(known_faces_dir)
                                 if fn.lower().endswith((".jpg", ".jpeg", ".png"))]
                if set(current_files) != set(known_names):
                    print("[INFO] Detected change in known_faces directory; rebuilding encodings cache.")
                    known_encodings = []
                    known_names = []
            except Exception:
                known_encodings = []
                known_names = []
        except Exception as e:
            print(f"[WARN] Failed to read encodings cache: {e}. Rebuilding from images.")

    if not known_names:
        # Attempt to fetch precomputed embeddings from Firestore first (cheaper than images)
        if not os.path.exists(encodings_cache):
            try:
                from firebase_utils import fetch_all_encodings, download_student_images
                fetched_encs, fetched_names = fetch_all_encodings()
                if fetched_encs and fetched_names:
                    # Convert to numpy arrays for face_recognition usage
                    for enc, name in zip(fetched_encs, fetched_names):
                        try:
                            arr = np.array(enc, dtype=np.float64)
                            known_encodings.append(arr)
                            known_names.append(name)
                        except Exception as e:
                            print(f"[WARN] Bad encoding for {name}: {e}")
                    print(f"[INFO] Loaded {len(known_names)} encodings from Firestore")
                else:
                    # Fall back to image downloads (one-time) if encodings not present
                    downloaded = download_student_images(known_faces_dir=known_faces_dir)
                    if downloaded:
                        print("[INFO] Finished downloading images from Firebase Storage")
                    else:
                        print("[INFO] No images were downloaded from Firebase Storage (none listed or already present)")
            except Exception as e:
                print(f"[WARN] Could not fetch encodings/images from Firebase via firebase_utils: {e}. Will build encodings from local folder if available.")

        # Build encodings from local folder
        os.makedirs(known_faces_dir, exist_ok=True)
        for filename in os.listdir(known_faces_dir):
            if filename.lower().endswith((".jpg", ".jpeg", ".png")):
                path = os.path.join(known_faces_dir, filename)
                name = os.path.splitext(filename)[0]
                try:
                    image = face_recognition.load_image_file(path)
                    encs = face_recognition.face_encodings(image)
                    if not encs:
                        print(f"[WARN] No face found in {filename}; skipping")
                        continue
                    encoding = encs[0]
                    known_encodings.append(encoding)
                    known_names.append(name)
                except Exception as e:
                    print(f"[WARN] Could not process {filename}: {e}")

        try:
            with open(encodings_cache, "wb") as f:
                pickle.dump({"encodings": known_encodings, "names": known_names}, f)
            print(f"[INFO] Saved {len(known_names)} encodings to cache")
        except Exception as e:
            print(f"[WARN] Failed to save encodings cache: {e}")

    return known_encodings, known_names
