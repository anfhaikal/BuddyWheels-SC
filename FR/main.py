import cv2
import face_recognition
import os
import pickle
import time
import numpy as np
from collections import deque, Counter
from datetime import datetime
import math

# Load known faces
from helpers import draw_text_bg, read_last_attendance, mark_attendance, load_known_faces

# Load known faces using helpers (this will load cache or build it from images,
# and will attempt a one-time Firebase Storage download on cache-miss)
known_faces_dir = "known_faces"
encodings_cache = os.path.join(known_faces_dir, "encodings.pickle")
known_encodings, known_names = load_known_faces(known_faces_dir, encodings_cache)

# Initialize webcam
video = cv2.VideoCapture(0)

attendance_log = "attendance.csv"

# seconds to wait before re-logging the same person
ATTENDANCE_COOLDOWN = 15

# track last attendance timestamp per person
attendance_timestamps = {}
# Matching and smoothing parameters
MATCH_THRESHOLD = 0.50    # distance threshold for accepting a match (lower = stricter)
MATCH_MARGIN = 0.10       # require second_best - best >= margin

# Temporal smoothing: require a name to appear at least SMOOTH_REQUIRED times
# within the last SMOOTH_WINDOW frames for a tracker to be confirmed
# Temporal smoothing: require a name to appear at least SMOOTH_REQUIRED times
# within the last SMOOTH_WINDOW frames for a tracker to be confirmed.
# Reduced defaults to lower latency: fewer frames required to confirm.
SMOOTH_WINDOW = 3
SMOOTH_REQUIRED = 2

# Association parameters (pixels)
ASSOC_DISTANCE = 80
# tracker time-to-live (seconds) for removing stale trackers
# Increased so boxes persist briefly if detection misses a frame or two
TRACKER_TTL = 4.0

# trackers: id -> {center, last_seen, history(deque), confirmed}
trackers = {}
next_tracker_id = 0

# UI / performance
FPS_UPDATE_INTERVAL = 0.5
_fps_last_time = time.time()
_fps_frame_count = 0
FPS = 0.0

# Attendance tail cache
LAST_ATT_READ = 0
LAST_ATT_LINES = []
ATT_TAIL_N = 5

print("[INFO] Starting camera... Press 'q' to quit.")

while True:
    ret, frame = video.read()
    if not ret:
        print("[ERROR] Failed to capture frame.")
        break

    # Resize frame for faster processing
    small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
    rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

    # Detect faces
    face_locations = face_recognition.face_locations(rgb_frame)
    face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

    # Build list of detected face centers (scaled up) and encodings
    detections = []  # each = (center_x, center_y, bbox_scaled, encoding)
    for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
        # Scale back up since we resized the frame earlier
        t = int(top * 4)
        r = int(right * 4)
        b = int(bottom * 4)
        l = int(left * 4)
        cx = int((l + r) / 2)
        cy = int((t + b) / 2)
        detections.append((cx, cy, (l, t, r, b), face_encoding))

    # Associate detections to existing trackers (simple nearest-center)
    used_tracker_ids = set()
    detection_assignments = {}  # det_idx -> tracker_id or None
    for i, (cx, cy, bbox, enc) in enumerate(detections):
        best_tid = None
        best_dist = float('inf')
        for tid, tr in list(trackers.items()):
            tx, ty = tr['center']
            d = (tx - cx) ** 2 + (ty - cy) ** 2
            if d < best_dist:
                best_dist = d
                best_tid = tid
        if best_tid is not None and best_dist <= ASSOC_DISTANCE ** 2 and best_tid not in used_tracker_ids:
            detection_assignments[i] = best_tid
            used_tracker_ids.add(best_tid)
        else:
            detection_assignments[i] = None

    # Create new trackers for unassigned detections
    for i, (cx, cy, bbox, enc) in enumerate(detections):
        tid = detection_assignments[i]
        if tid is None:
            tid = next_tracker_id
            next_tracker_id += 1
            trackers[tid] = {
                'center': (cx, cy),
                'last_seen': time.time(),
                'history': deque(maxlen=SMOOTH_WINDOW),
                'confirmed': False,
                'name': 'Unknown',
                'bbox': bbox,
                'updated': True
            }
            detection_assignments[i] = tid

    # Update trackers with detections: run matching and update history
    for i, (cx, cy, bbox, enc) in enumerate(detections):
        tid = detection_assignments[i]
        tr = trackers.get(tid)
        if tr is None:
            continue
        tr['center'] = (cx, cy)
        tr['last_seen'] = time.time()
        tr['bbox'] = bbox
        tr['updated'] = True

        # Compute distances to known encodings
        name = 'Unknown'
        if known_encodings:
            distances = face_recognition.face_distance(known_encodings, enc)
            best_idx = int(np.argmin(distances))
            best_dist = float(distances[best_idx])
            sorted_idx = np.argsort(distances)
            second_best_dist = float(distances[sorted_idx[1]]) if len(distances) > 1 else float('inf')
            if best_dist <= MATCH_THRESHOLD and (second_best_dist - best_dist) >= MATCH_MARGIN:
                name = known_names[best_idx]

        # push into tracker history and possibly confirm
        tr['history'].append(name)
        # determine most common name in history
        cnt = Counter(tr['history'])
        most_common_name, count = cnt.most_common(1)[0]
        previously_confirmed = tr['confirmed']
        if most_common_name != 'Unknown' and count >= SMOOTH_REQUIRED:
            tr['confirmed'] = True
            tr['name'] = most_common_name
        else:
            tr['confirmed'] = False
            tr['name'] = 'Unknown'

        # If it became confirmed just now, mark attendance (with cooldown)
        now_ts = time.time()
        if tr['confirmed'] and not previously_confirmed:
            last_seen = attendance_timestamps.get(tr['name'])
            if last_seen is None or (now_ts - last_seen) >= ATTENDANCE_COOLDOWN:
                mark_attendance(tr['name'])
                attendance_timestamps[tr['name']] = now_ts

        # Draw bounding box and name on frame with modern white/green theme
        l, t, r, b = bbox
        GREEN = (104, 250, 75)  # BGR for #4bfa68
        LIGHT_GRAY = (200, 200, 200)
        DARK_TEXT = (20, 20, 20)
        box_color = GREEN if tr['confirmed'] else LIGHT_GRAY
        cv2.rectangle(frame, (l, t), (r, b), box_color, 2)
        # label background in white with dark text and green border when confirmed
        border = GREEN if tr['confirmed'] else None
        draw_text_bg(frame, tr['name'], (l + 6, b - 6), font_scale=0.7, color=DARK_TEXT, bg_color=(255,255,255), thickness=1, pad=6, border_color=border)

    # Draw trackers that were NOT updated this frame (use last known bbox)
    now_time = time.time()
    for tid, tr in list(trackers.items()):
        if not tr.get('updated', False):
            # if within TTL, draw faded box to indicate recent last-seen
            age = now_time - tr['last_seen']
            if age <= TRACKER_TTL:
                l, t, r, b = tr.get('bbox', (0,0,0,0))
                fade = max(0.15, 1.0 - (age / TRACKER_TTL))
                # faded gray box
                gray = (int(200*fade + 55*(1-fade)),)*3
                cv2.rectangle(frame, (l, t), (r, b), gray, 2)
                label = f"{tr.get('name','Unknown')} (last {int(age)}s)"
                draw_text_bg(frame, label, (l + 6, b - 6), font_scale=0.6, color=(20,20,20), bg_color=(255,255,255))
            # else: will be removed below

    # Remove stale trackers
    stale = [tid for tid, tr in trackers.items() if now_time - tr['last_seen'] > TRACKER_TTL]
    for tid in stale:
        del trackers[tid]

    # --- UI: update FPS and attendance tail cache ---
    _fps_frame_count += 1
    now_time = time.time()
    if now_time - _fps_last_time >= FPS_UPDATE_INTERVAL:
        try:
            FPS = _fps_frame_count / (now_time - _fps_last_time)
        except ZeroDivisionError:
            FPS = 0.0
        _fps_frame_count = 0
        _fps_last_time = now_time

    if now_time - LAST_ATT_READ > 1.0:
        LAST_ATT_LINES = read_last_attendance(ATT_TAIL_N)
        LAST_ATT_READ = now_time

    # Draw a white info panel with green header (modern look)
    h, w = frame.shape[:2]
    panel_w = 360
    panel_h = 140
    x0 = w - panel_w - 10
    y0 = 10
    # white panel with slight transparency
    overlay = frame.copy()
    cv2.rectangle(overlay, (x0, y0), (x0 + panel_w, y0 + panel_h), (255, 255, 255), -1)
    alpha = 0.9
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

    # green header bar
    GREEN = (104, 250, 75)  # BGR
    header_h = 28
    cv2.rectangle(frame, (x0, y0), (x0 + panel_w, y0 + header_h), GREEN, -1)
    # Panel contents (dark text on white)
    DARK_TEXT = (20, 20, 20)
    draw_text_bg(frame, "BuddyWheels", (x0 + 12, y0 + 22), font_scale=0.65, color=(255,255,255), bg_color=GREEN)
    draw_text_bg(frame, f"FPS: {FPS:.1f}", (x0 + 12, y0 + 50), color=DARK_TEXT, bg_color=(255,255,255))
    draw_text_bg(frame, f"Known: {len(known_names)}", (x0 + 12, y0 + 78), color=DARK_TEXT, bg_color=(255,255,255))
    confirmed_count = sum(1 for t in trackers.values() if t['confirmed'])
    draw_text_bg(frame, f"Confirmed: {confirmed_count}", (x0 + 12, y0 + 106), color=DARK_TEXT, bg_color=(255,255,255))
    draw_text_bg(frame, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), (x0 + 12, y0 + 130), font_scale=0.45, color=DARK_TEXT, bg_color=(255,255,255))

    # Draw recent attendance lines below the panel with white background
    att_x = 12
    att_y = h - (ATT_TAIL_N * 20) - 12
    draw_text_bg(frame, "Recent Attendance:", (att_x, att_y - 6), font_scale=0.6, color=DARK_TEXT, bg_color=(255,255,255))
    for i, line in enumerate(LAST_ATT_LINES[-ATT_TAIL_N:]):
        draw_text_bg(frame, line, (att_x, att_y + i * 20), font_scale=0.5, color=DARK_TEXT, bg_color=(255,255,255))

    cv2.imshow("BuddyWheels Facial Recognition", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

video.release()
cv2.destroyAllWindows()
