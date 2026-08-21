"""Seed students from known_faces and upload encodings to Firestore.

This script will:
 - scan `known_faces/` for image files
 - for each file, create a `students/{studentID}` document with fields:
     class, classID, gender, grade, name, parentID, studentID
 - compute a face_recognition embedding (requires exactly one face) and upload
   it under `students/{studentID}/encodings/` using firebase_utils.upload_student_encoding
 - optionally upload the image to Storage and add a gs:// URL to `image_urls` on the student doc

Usage:
  python seed_students_with_encodings.py --sa 'C:\path\to\sa.json' --known-dir known_faces --grade 10 --class 10A --upload-images --bucket your-bucket

Use --dry-run to preview actions without writing to Firestore/Storage.
"""
from typing import List
import os
import argparse
import sys
import random

import firebase_utils

try:
    import face_recognition
except Exception:
    face_recognition = None


def prettify_name(basename: str) -> str:
    n = os.path.splitext(basename)[0]
    n = n.replace('_', ' ').replace('-', ' ')
    parts = [p.capitalize() for p in n.split() if p]
    return ' '.join(parts)


def scan_known_faces(known_dir: str = 'known_faces') -> List[dict]:
    exts = ('.jpg', '.jpeg', '.png', '.bmp')
    out = []
    if not os.path.isdir(known_dir):
        return out
    for fn in sorted(os.listdir(known_dir)):
        if not any(fn.lower().endswith(e) for e in exts):
            continue
        base = os.path.splitext(fn)[0]
        sid = base
        name = prettify_name(base)
        path = os.path.join(known_dir, fn)
        out.append({'studentID': sid, 'name': name, 'path': path, 'filename': fn})
    return out


def make_payload(studentID: str, name: str, grade: str, class_name: str) -> dict:
    gender = random.choice(['M', 'F'])
    payload = {
        'studentID': studentID,
        'name': name,
        'grade': grade,
        'class': class_name,
        'classID': class_name,
        'gender': gender,
        'parentID': f'P_{studentID}',
    }
    return payload


def upload_image(bucket, student_id: str, filename: str, local_path: str) -> str:
    blob_name = f'students/{student_id}/{filename}'
    blob = bucket.blob(blob_name)
    blob.upload_from_filename(local_path)
    return f'gs://{bucket.name}/{blob_name}'


def main():
    parser = argparse.ArgumentParser(description='Seed students from known_faces and upload encodings')
    parser.add_argument('--sa', help='Service account JSON path (optional if ADC)')
    parser.add_argument('--known-dir', default='known_faces')
    parser.add_argument('--grade', default='10')
    parser.add_argument('--class', dest='class_name', default='10A')
    parser.add_argument('--upload-images', action='store_true', help='Also upload images to Storage')
    parser.add_argument('--bucket', default=None, help='Storage bucket name (if uploading images)')
    parser.add_argument('--dry-run', action='store_true', help='Print actions but do not write')
    args = parser.parse_args()

    if face_recognition is None:
        print('[ERROR] face_recognition is not available in this environment. Install dependencies before running.')
        sys.exit(1)

    db, bucket = firebase_utils.init_firebase(sa_path=args.sa, bucket_name=(args.bucket or None))
    if db is None and not args.dry_run:
        print('[ERROR] Firebase initialization failed. Provide valid credentials or use --dry-run')
        sys.exit(1)

    items = scan_known_faces(args.known_dir)
    if not items:
        print(f'[ERROR] No images found in {args.known_dir}')
        return

    print(f'[INFO] Found {len(items)} images; processing... (dry-run={args.dry_run})')

    for it in items:
        sid = it['studentID']
        name = it['name']
        path = it['path']
        filename = it['filename']

        payload = make_payload(sid, name, args.grade, args.class_name)

        if args.dry_run:
            print(f"[DRY] Would create/update student {sid}: {payload}")
        else:
            try:
                db.collection('students').document(sid).set(payload, merge=True)
                print(f"[INFO] Created/updated student {sid}")
            except Exception as e:
                print(f"[WARN] Failed to write student {sid}: {e}")
                continue

        # compute embedding
        try:
            img = face_recognition.load_image_file(path)
            locs = face_recognition.face_locations(img)
            if not locs:
                print(f"[WARN] No face detected in {path}; skipping embedding for {sid}")
                continue
            if len(locs) > 1:
                print(f"[WARN] Multiple faces in {path}; skipping embedding for {sid}")
                continue
            encs = face_recognition.face_encodings(img, locs)
            if not encs:
                print(f"[WARN] Failed to compute embedding for {sid}")
                continue
            embedding = encs[0]
        except Exception as e:
            print(f"[WARN] Error processing {path}: {e}")
            continue

        if args.dry_run:
            print(f"[DRY] Would upload embedding for {sid} (len={len(embedding)})")
        else:
            ok = firebase_utils.upload_student_encoding(sid, embedding, sa_path=args.sa)
            print(f"[INFO] Uploaded embedding for {sid}: {ok}")

        if args.upload_images:
            if bucket is None:
                print('[WARN] No storage bucket available; skipping image upload')
            else:
                try:
                    gs_url = upload_image(bucket, sid, filename, path)
                    print(f"[INFO] Uploaded image for {sid} -> {gs_url}")
                    # append to image_urls array on student doc
                    try:
                        db.collection('students').document(sid).set({'image_urls': firebase_utils.firebase_admin.firestore.ArrayUnion([gs_url])}, merge=True)
                    except Exception:
                        db.collection('students').document(sid).set({'image_urls': [gs_url]}, merge=True)
                except Exception as e:
                    print(f"[WARN] Failed to upload image for {sid}: {e}")

    print('[INFO] All done')


if __name__ == '__main__':
    main()
