"""Admin enrollment script

Captures N validated photos from the webcam, computes face embeddings using
face_recognition, uploads an optional compressed thumbnail to Firebase Storage,
and writes embeddings + metadata to Firestore under `students/{student_id}`.

Usage:
  python enroll_admin.py --id STUDENT_ID [--n 3] [--sa path/to/sa.json] [--bucket BUCKET_NAME]

If Firebase is not available, the script will still capture and save images locally
under `enrollments/{student_id}/` and print the embeddings to stdout as fallback.

ISSUE: Webcam-captured photos are not accurate for generating facial embeddings
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import tempfile
from typing import List, Optional

try:
    import cv2
    import face_recognition
    import numpy as np
except Exception as e:
    print(f"[ERROR] Missing dependency: {e}. Install requirements (opencv-python, face_recognition).")
    raise

import firebase_utils


def make_thumbnail_bgr(frame_bgr, width=320, quality=70) -> bytes:
    """Resize BGR frame to width px and return JPEG bytes.

    Uses OpenCV's imencode for JPEG compression.
    """
    h, w = frame_bgr.shape[:2]
    if w != width:
        scale = width / float(w)
        frame_bgr = cv2.resize(frame_bgr, (width, int(h * scale)), interpolation=cv2.INTER_AREA)
    # encode as JPEG
    ok, buf = cv2.imencode('.jpg', frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise RuntimeError('Failed to encode thumbnail')
    return buf.tobytes()


def capture_embeddings(n: int = 3, camera_index: int = 0) -> List[tuple]:
    """Open camera and interactively capture N embeddings.

    Returns list of tuples: (frame_bgr, embedding)
    """
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError('Could not open camera')

    collected = []
    window = 'Enrollment - follow the prompts (q to quit)'
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)

    def guidance_labels(count: int) -> List[str]:
        # Provide friendly pose instructions for common n values.
        defaults = [
            'Center (frontal) - look at the camera',
            'Turn slightly left',
            'Turn slightly right',
            'Look up slightly',
            'Look down slightly',
            'Slight smile / neutral'
        ]
        if count <= len(defaults):
            return defaults[:count]
        # If more required, repeat cyclically with suffix
        labels = []
        for i in range(count):
            labels.append(defaults[i % len(defaults)])
        return labels

    labels = guidance_labels(n)

    try:
        while len(collected) < n:
            # Show live preview with instruction and a short countdown
            instr = labels[len(collected)]
            countdown = 3
            while countdown > 0:
                ret, frame = cap.read()
                if not ret:
                    print('[WARN] Failed to read frame from camera')
                    time.sleep(0.1)
                    continue
                display = frame.copy()
                # instruction text
                cv2.putText(display, f'Capture {len(collected)+1}/{n}: {instr}', (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2, cv2.LINE_AA)
                # countdown big
                cv2.putText(display, str(countdown), (display.shape[1]//2 - 20, display.shape[0]//2), cv2.FONT_HERSHEY_SIMPLEX, 3.0, (0,255,255), 4, cv2.LINE_AA)
                cv2.imshow(window, display)
                key = cv2.waitKey(1000) & 0xFF
                if key == ord('q'):
                    raise KeyboardInterrupt()
                countdown -= 1

            # capture frame at end of countdown
            ret, frame = cap.read()
            if not ret:
                print('[WARN] Failed to read frame from camera')
                continue
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            locations = face_recognition.face_locations(rgb)
            display = frame.copy()
            if len(locations) == 0:
                print('[WARN] No face detected - please reposition and try again')
                cv2.putText(display, 'No face found - try again', (10,60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2)
                cv2.imshow(window, display)
                cv2.waitKey(1200)
                continue
            if len(locations) > 1:
                print('[WARN] Multiple faces detected - ensure only the student is visible')
                cv2.putText(display, 'Multiple faces - try again', (10,60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2)
                cv2.imshow(window, display)
                cv2.waitKey(1200)
                continue

            encs = face_recognition.face_encodings(rgb, locations)
            if not encs:
                print('[WARN] Failed to compute embedding - try again')
                continue
            embedding = encs[0]
            collected.append((frame.copy(), embedding))
            print(f'[INFO] Captured embedding {len(collected)}/{n}')
            # show confirmation
            cv2.putText(display, 'Captured ✓', (10,60), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,255,0), 2)
            cv2.imshow(window, display)
            cv2.waitKey(700)

        return collected
    finally:
        cap.release()
        cv2.destroyWindow(window)


def upload_to_firebase(student_id: str, captures: List[tuple], sa_path: Optional[str], bucket_name: Optional[str], upload_thumb: bool = True) -> bool:
    """Uploads embeddings and thumbnail to Firestore/Storage.

    Returns True on success.
    """
    db, bucket = firebase_utils.init_firebase(sa_path=sa_path, bucket_name=bucket_name)
    if db is None:
        print('[WARN] Firebase not initialized; skipping upload')
        return False

    embeddings = [[float(x) for x in emb] for (_, emb) in captures]

    thumb_gs = None
    if upload_thumb and bucket is not None:
        try:
            thumb_bytes = make_thumbnail_bgr(captures[0][0], width=320, quality=70)
            blob_name = f'students/{student_id}/thumbnail_{int(time.time())}.jpg'
            blob = bucket.blob(blob_name)
            blob.upload_from_string(thumb_bytes, content_type='image/jpeg')
            thumb_gs = f'gs://{bucket.name}/{blob_name}'
            print(f'[INFO] Uploaded thumbnail to {thumb_gs}')
        except Exception as e:
            print(f'[WARN] Failed to upload thumbnail: {e}')

    # Firestore doesn't allow nested arrays (arrays-of-arrays). Store each
    # embedding as a map/object so the array contains maps (allowed).
    enc_objects = [{'values': emb} for emb in embeddings]

    # prepare metadata
    metadata = {
        'name': student_id,
        'encodings': enc_objects,
        'uploaded_by': os.getenv('USERNAME') or os.getenv('USER') or 'admin',
        'uploaded_at': firebase_utils.firebase_admin.firestore.SERVER_TIMESTAMP if getattr(firebase_utils, 'firebase_admin', None) else None,
        'model_version': 'face_recognition-dlib-128-v1',
        'embedding_count': len(embeddings),
    }
    if thumb_gs:
        metadata['thumbnail_gs_url'] = thumb_gs

    try:
        doc_ref = db.collection('students').document(student_id)
        doc_ref.set(metadata, merge=True)
        print(f'[INFO] Wrote student document for {student_id} (encodings: {len(embeddings)})')
        return True
    except Exception as e:
        print(f'[WARN] Failed to write Firestore doc: {e}')
        return False


def save_local(student_id: str, captures: List[tuple], out_dir: str = 'enrollments'):
    os.makedirs(out_dir, exist_ok=True)
    student_dir = os.path.join(out_dir, student_id)
    os.makedirs(student_dir, exist_ok=True)
    for i, (frame, emb) in enumerate(captures, start=1):
        fname = os.path.join(student_dir, f'{student_id}_{i}.jpg')
        cv2.imwrite(fname, frame)
    # save embeddings as a plain text file for quick reference
    emb_path = os.path.join(student_dir, 'encodings.txt')
    with open(emb_path, 'w') as fh:
        for emb in [e.tolist() if hasattr(e, 'tolist') else list(e) for (_, e) in captures]:
            fh.write(','.join(map(str, emb)) + '\n')
    print(f'[INFO] Saved {len(captures)} captures and encodings to {student_dir}')


def main():
    parser = argparse.ArgumentParser(description='Admin enrollment utility')
    parser.add_argument('--id', required=False, help='Student ID (document ID in Firestore). If omitted you will be prompted.')
    parser.add_argument('--n', type=int, default=3, help='Number of captures (recommended 3-5)')
    parser.add_argument('--sa', type=str, default=None, help='Path to service account JSON (optional)')
    parser.add_argument('--bucket', type=str, default=None, help='Explicit Firebase storage bucket name (optional)')
    parser.add_argument('--no-upload-thumb', action='store_true', help='Do not upload thumbnail to Storage')
    parser.add_argument('--save-local', action='store_true', help='Also save captures locally under enrollments/{id}/')
    args = parser.parse_args()

    # Ensure we have a student id; prompt interactively if not provided or if user
    # wants to change it.
    student_id = args.id
    while not student_id:
        student_id = input('Enter student ID to enroll: ').strip()
        if not student_id:
            print('Student ID cannot be empty.')

    # Confirm the student id before capturing
    while True:
        resp = input(f"Enroll for student id '{student_id}'? (Enter=Yes / n to change): ").strip().lower()
        if resp == '' or resp.startswith('y'):
            break
        if resp.startswith('n'):
            student_id = input('Enter student ID to enroll: ').strip()
            continue
        print('Please answer Y (yes) or n (change id).')

    try:
        captures = capture_embeddings(n=args.n)
    except KeyboardInterrupt:
        print('\n[INFO] Enrollment cancelled by user')
        sys.exit(0)
    except Exception as e:
        print(f'[ERROR] Camera/capture failed: {e}')
        sys.exit(1)

    if args.save_local:
        save_local(student_id, captures)

    uploaded = upload_to_firebase(student_id, captures, sa_path=args.sa, bucket_name=args.bucket, upload_thumb=(not args.no_upload_thumb))
    if not uploaded:
        print('[WARN] Upload to Firebase failed or was skipped; local copies retained if --save-local used')


if __name__ == '__main__':
    main()
