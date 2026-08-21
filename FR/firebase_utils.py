"""firebase_utils.py

Helper wrapper around firebase-admin for initializing the SDK, downloading
student images (one-time) and logging attendance to Firestore.

This module keeps Firebase-specific code in one place so device-side code
can be clearer. It expects environment variables to be set when needed:
- GOOGLE_APPLICATION_CREDENTIALS -> path to service account JSON (optional if ADC)
- FIREBASE_STORAGE_BUCKET -> optional explicit storage bucket name
"""
import os
import urllib.request
from typing import Optional
from datetime import datetime

firebase_admin = None
# mapping of student document id -> display name (populated by fetch_all_encodings)
LAST_STUDENT_NAME_MAP = {}


def init_firebase(sa_path: Optional[str] = None, bucket_name: Optional[str] = None):
    """Initialize firebase_admin app if not already initialized.

    Returns (firestore_client, storage_bucket) or (None, None) on failure.
    """
    global firebase_admin
    try:
        import firebase_admin as _fa
        from firebase_admin import credentials, firestore, storage as fb_storage
    except Exception as e:
        print(f"[WARN] firebase-admin is not installed or failed to import: {e}")
        return None, None

    firebase_admin = _fa

    try:
        if not firebase_admin._apps:
            sa = sa_path or os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            if sa:
                cred = credentials.Certificate(sa)
                if bucket_name or os.getenv('FIREBASE_STORAGE_BUCKET'):
                    firebase_admin.initialize_app(cred, {
                        'storageBucket': bucket_name or os.getenv('FIREBASE_STORAGE_BUCKET')
                    })
                else:
                    firebase_admin.initialize_app(cred)
            else:
                firebase_admin.initialize_app()

        db = firestore.client()
        try:
            bucket = fb_storage.bucket() if (bucket_name is None and os.getenv('FIREBASE_STORAGE_BUCKET') is None) else fb_storage.bucket(bucket_name or os.getenv('FIREBASE_STORAGE_BUCKET'))
        except Exception:
            bucket = None
        return db, bucket
    except Exception as e:
        print(f"[WARN] Failed to initialize Firebase Admin: {e}")
        return None, None


def download_student_images(known_faces_dir: str = 'known_faces', sa_path: Optional[str] = None, bucket_name: Optional[str] = None) -> int:
    """Download images referenced in Firestore `students` documents into `known_faces_dir`.

    Returns the number of images downloaded (0 if none or on error).
    """
    db, bucket = init_firebase(sa_path=sa_path, bucket_name=bucket_name)
    if db is None:
        return 0

    try:
        students = db.collection('students').stream()
    except Exception as e:
        print(f"[WARN] Could not read 'students' collection: {e}")
        return 0

    os.makedirs(known_faces_dir, exist_ok=True)
    any_downloaded = 0

    for doc in students:
        data = doc.to_dict()
        student_name = data.get('name', doc.id)
        image_urls = data.get('image_urls', []) or []
        for idx, url in enumerate(image_urls):
            local_name = f"{student_name}_{idx+1}.jpg"
            local_path = os.path.join(known_faces_dir, local_name)
            if os.path.exists(local_path):
                continue
            if isinstance(url, str) and url.startswith('gs://') and bucket is not None:
                try:
                    parts = url.replace('gs://', '').split('/', 1)
                    blob_path = parts[1] if len(parts) > 1 else None
                    if blob_path:
                        blob = bucket.blob(blob_path)
                        blob.download_to_filename(local_path)
                        any_downloaded += 1
                        print(f"[INFO] Downloaded {url} -> {local_path}")
                except Exception as e:
                    print(f"[WARN] Failed to download {url}: {e}")
            elif isinstance(url, str) and url.startswith('http'):
                try:
                    urllib.request.urlretrieve(url, local_path)
                    any_downloaded += 1
                    print(f"[INFO] Downloaded {url} -> {local_path}")
                except Exception as e:
                    print(f"[WARN] Failed to download {url}: {e}")
            else:
                print(f"[WARN] Skipping unknown image URL for {student_name}: {url}")

    if any_downloaded:
        print(f"[INFO] Downloaded {any_downloaded} images from Firebase Storage")
    else:
        print("[INFO] No images downloaded from Firebase Storage")
    return any_downloaded


def log_attendance_firestore(name: Optional[str] = None, student_id: Optional[str] = None, timestamp: Optional[str] = None, sa_path: Optional[str] = None) -> bool:
    """Write an attendance record to Firestore collection `attendance`.

    Preferred usage: provide `student_id` so the document ID can be deterministic
    ("YYYY-MM-DD_{student_id}"). If only `name` is provided, the function will
    fall back to creating a new document with an auto-ID (legacy behaviour).

    If timestamp is None, Firestore server timestamp will be used.
    Returns True on success.
    """
    db, _ = init_firebase(sa_path=sa_path)
    if db is None:
        return False
    try:
        rec = {
            'name': name if name is not None else (LAST_STUDENT_NAME_MAP.get(student_id) if student_id else None),
            'studentID': student_id,
            'recorded_at': timestamp if timestamp is not None else firebase_admin.firestore.SERVER_TIMESTAMP,
            'source': 'device'
        }
        # If student_id provided, use deterministic doc id to avoid duplicates
        if student_id:
            date_str = datetime.utcnow().strftime('%Y-%m-%d')
            doc_id = f"{date_str}_{student_id}"
            db.collection('attendance').document(doc_id).set(rec)
        else:
            db.collection('attendance').add(rec)
        return True
    except Exception as e:
        print(f"[WARN] Failed to write attendance to Firestore: {e}")
        return False


def fetch_all_encodings(sa_path: Optional[str] = None, bucket_name: Optional[str] = None):
    """Fetch precomputed face embeddings from Firestore `students` collection.

    This function returns (encodings_list, student_id_list). The second list
    contains Firestore document IDs (student IDs). A module-level mapping
    `LAST_STUDENT_NAME_MAP` is populated to map student_id -> display name.

    Returns (encodings_list, student_id_list).
    """
    db, _ = init_firebase(sa_path=sa_path, bucket_name=bucket_name)
    if db is None:
        return [], []

    encs = []
    names = []
    try:
        students = db.collection('students').stream()
    except Exception as e:
        print(f"[WARN] Could not read 'students' collection for encodings: {e}")
        return [], []

    # reset the global mapping
    global LAST_STUDENT_NAME_MAP
    LAST_STUDENT_NAME_MAP = {}

    for doc in students:
        data = doc.to_dict() or {}
        display_name = data.get('name', doc.id)
        student_id = doc.id
        LAST_STUDENT_NAME_MAP[student_id] = display_name

        e_field = data.get('encodings')
        if e_field is None:
            # If no inline encodings field, look for a subcollection 'encodings'
            try:
                enc_col = db.collection('students').document(student_id).collection('encodings').stream()
                found = False
                for enc_doc in enc_col:
                    found = True
                    enc_data = enc_doc.to_dict() or {}
                    # support different keys
                    if 'values' in enc_data and isinstance(enc_data['values'], list):
                        encs.append([float(x) for x in enc_data['values']])
                        names.append(student_id)
                    elif 'encoding' in enc_data and isinstance(enc_data['encoding'], list):
                        encs.append([float(x) for x in enc_data['encoding']])
                        names.append(student_id)
                    else:
                        # try to find any list value in the document and use it
                        for v in enc_data.values():
                            if isinstance(v, list):
                                encs.append([float(x) for x in v])
                                names.append(student_id)
                                break
                if found:
                    continue
            except Exception:
                # ignore permission/stream errors and continue
                pass

        # e_field can be several shapes depending on how it was written previously
        if isinstance(e_field, list):
            # list-of-things: try to detect list of numbers (single 1D encoding)
            if e_field and all(isinstance(i, (int, float)) for i in e_field):
                encs.append([float(x) for x in e_field])
                names.append(student_id)
            else:
                for sub in e_field:
                    if isinstance(sub, list):
                        encs.append([float(x) for x in sub])
                        names.append(student_id)
                    elif isinstance(sub, dict):
                        # look for common keys that carry the numeric list
                        for k in ('values', 'encoding', 'vector'):
                            if k in sub and isinstance(sub[k], list):
                                encs.append([float(x) for x in sub[k]])
                                names.append(student_id)
                                break
        elif isinstance(e_field, dict):
            # e_field is a dict mapping (e.g. {'0': [...], '1': [...]})
            for k, v in e_field.items():
                if isinstance(v, list):
                    encs.append([float(x) for x in v])
                    names.append(student_id)

    return encs, names


def upload_student_encoding(name: str, encoding, sa_path: Optional[str] = None, merge: bool = True) -> bool:
    """Upload a single embedding for `name` into Firestore `students` doc.

    If merge=True and document exists, this will set/replace the `encodings` field.
    Encoding must be a list or numpy array; it will be converted to plain list of floats.
    """
    db, _ = init_firebase(sa_path=sa_path)
    if db is None:
        return False
    try:
        enc_list = [float(x) for x in (encoding.tolist() if hasattr(encoding, 'tolist') else encoding)]
        doc_ref = db.collection('students').document(name)
        # Preferred: add encoding as a document in the students/{name}/encodings
        # subcollection. This avoids nested arrays in the main document.
        try:
            doc_ref.set({'name': name}, merge=True)
            enc_col = doc_ref.collection('encodings')
            enc_col.add({
                'values': enc_list,
                'uploaded_by': os.getenv('USERNAME') or os.getenv('USER') or 'admin',
                'uploaded_at': firebase_admin.firestore.SERVER_TIMESTAMP,
                'model_version': 'face_recognition-dlib-128-v1',
            })
            return True
        except Exception:
            # Fallback: write inline encodings field (best-effort)
            try:
                if merge:
                    doc_ref.set({'name': name, 'encodings': enc_list}, merge=True)
                else:
                    doc_ref.set({'name': name, 'encodings': enc_list})
                return True
            except Exception as e:
                print(f"[WARN] Failed to upload encoding for {name}: {e}")
                return False
    except Exception as e:
        print(f"[WARN] Failed to upload encoding for {name}: {e}")
        return False
