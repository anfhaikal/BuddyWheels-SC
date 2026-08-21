# Facial Recognition for Attendance — Enrollment README

This project implements a simple webcam-based face recognition attendance system built with OpenCV and `face_recognition` (dlib). This README covers the admin enrollment flow and how to use the provided `enroll_admin.py` script to add student embeddings and an optional thumbnail to Firestore/Storage.

## What the enrollment script does

- Captures N photos from the admin machine's webcam (default N = 3).
- For each photo: validates there is exactly one face. Rejects captures with 0 or >1 faces.
- Computes 128-D embeddings using `face_recognition` (dlib).
- Optionally uploads a compressed thumbnail (JPEG, 320 px wide, quality 70) to Firebase Storage.
- Writes embeddings and metadata to Firestore under `students/{student_id}`.
- Optionally saves local copies to `enrollments/{student_id}/`.

Files added by this feature:

- `enroll_admin.py` — interactive admin enrollment script (capture → validate → embed → upload/save).

## Dependencies

Install dependencies in your environment. Using conda is recommended on Windows for `dlib`:

PowerShell / Conda example:

```powershell
conda create -n face-env python=3.10 -y
conda activate face-env
conda install -c conda-forge dlib opencv numpy -y
pip install face_recognition firebase-admin
```

Or, if you already have a working environment, ensure these packages are installed:

- opencv-python
- face_recognition
- numpy
- firebase-admin (optional; script still works and can save locally without Firebase)

## Firebase setup (optional)

If you want the script to upload thumbnails and save embeddings to Firestore:

1. Create a Firebase project with Firestore and a Cloud Storage bucket.
2. Create a service account with permissions to read/write Firestore and Storage and download the JSON key.
3. On the admin machine either:
   - Set the environment variable `GOOGLE_APPLICATION_CREDENTIALS` to the service account JSON path, or
   - Pass the `--sa` argument to the script: `--sa C:\path\to\service-account.json`.
4. Optionally set `FIREBASE_STORAGE_BUCKET` environment variable or pass `--bucket` to the script.

Security note: do not ship service-account JSONs to untrusted devices. For production, prefer a secure server-side enrollment endpoint that performs embedding computation and stores data centrally.

## Usage (PowerShell)

Basic capture (uses ADC or GOOGLE_APPLICATION_CREDENTIALS if set):

```powershell
python enroll_admin.py --id STUDENT123
```

Capture 4 photos, save local copies, and explicitly pass service-account + bucket:

```powershell
python enroll_admin.py --id STUDENT123 --n 4 --sa "C:\keys\svc.json" --bucket "my-bucket" --save-local
```

Skip thumbnail upload if you only want embeddings stored:

```powershell
python enroll_admin.py --id STUDENT123 --no-upload-thumb
```

Exit & cancel: press `q` during capture to cancel enrollment.

## Firestore document format

The script writes a merged document to `students/{student_id}` containing fields similar to:

```json
{
  "name": "STUDENT123",
  "encodings": [[...], [...]],
  "uploaded_by": "admin",
  "uploaded_at": "SERVER_TIMESTAMP",
  "model_version": "face_recognition-dlib-128-v1",
  "embedding_count": 3,
  "thumbnail_gs_url": "gs://..." // optional
}
```

If you prefer to append embeddings rather than replace/merge, we can change the implementation to use Firestore array operations (arrayUnion) or a read/append/write pattern.

## Troubleshooting

- If the camera doesn't open: ensure no other application is using the webcam and that OpenCV can access it. Try changing the camera index (`camera_index` variable in the script or modify the script to accept `--camera`).
- If dlib/face_recognition installation fails on Windows, use conda-forge to install `dlib` or use a prebuilt wheel for your Python version.
- If Firebase initialization fails, the script will print warnings and optionally save local captures under `enrollments/` so you don't lose data.

## Next steps (optional enhancements)

- Add a server-side enrollment endpoint (FastAPI) to avoid exposing service-account keys on client/admin machines.
- Add atomic append semantics for `encodings` using Firestore `arrayUnion`.
- Add auto-capture with countdown and better UI/UX for kiosks.

---

If you want, I can (A) implement a secure FastAPI enrollment endpoint plus a small client that uploads images to it, or (B) change Firestore writes to arrayUnion semantics. Which would you prefer next?

# BuddyWheels — Facial Recognition for Attendance

Simple, local facial-recognition attendance app using face_recognition (dlib) and OpenCV.

This repository captures webcam frames, detects faces, matches against a local
"known faces" cache, and logs attendance to `attendance.csv`. It uses a local
cache (`known_faces/encodings.pickle`) to avoid repeated downloads and expensive
encoding computation. On first run (cache miss) it can optionally download
enrollment images from Firebase Storage / Firestore if configured.

---

## Quick overview

- `main.py` — application entrypoint, runs webcam loop, draws UI, marks attendance.
- `helpers.py` — helper functions (UI helpers, attendance helpers, and `load_known_faces`
  which builds/loads encodings and performs one-time Firebase image download on cache-miss).
- `known_faces/` — directory that should contain student images (e.g. `Alice.jpg`).
- `known_faces/encodings.pickle` — cached list of encodings and names (created automatically).
- `attendance.csv` — append-only log of attendance entries.

## Requirements

- Python 3.8+ (3.10/3.11/3.12 tested in development). Use conda on Windows for dlib.
- Packages (pip/conda): OpenCV (`opencv-python`), `face_recognition` (depends on `dlib`),
  `numpy`, optionally `firebase-admin` and `google-cloud-storage` if you use Firebase features.

Recommended (conda) install when on Windows to avoid compiling dlib:

```powershell
conda create -n buddyface python=3.10 -y
conda activate buddyface
conda install -c conda-forge dlib opencv numpy -y
pip install face_recognition firebase-admin google-cloud-storage
```

If you're using a virtualenv (venv) instead of conda, you'll need system CMake and
Visual Studio Build Tools installed before `pip install dlib` will succeed.

## Run the app

Activate your environment and run:

```powershell
# if using venv in repo
& .\venv\Scripts\Activate.ps1
python .\main.py

# if using conda
conda activate buddyface
python .\main.py
```

Press `q` in the window to quit.

## Forcing a rebuild of known-face encodings

- The app stores computed encodings in `known_faces/encodings.pickle` for faster startup.
- To force a rebuild, delete that file and restart the app:

```powershell
Remove-Item .\known_faces\encodings.pickle
python .\main.py
```

Or add/remove images in `known_faces/` — the loader detects filename changes and will rebuild.

## Firebase integration (optional)

On a cache miss the loader will attempt a one-time fetch of images from Firestore (`students` collection)
and Cloud Storage. This is optional — if Firebase is not configured the loader will simply use local files.

Environment variables used for Firebase features:

- `GOOGLE_APPLICATION_CREDENTIALS` — path to service account JSON (or rely on ADC)
- `FIREBASE_STORAGE_BUCKET` — optional explicit bucket name (e.g. `my-bucket.appspot.com`)

Firestore `students` document format suggested (example):

```json
{
  "name": "Alice",
  "image_urls": ["gs://my-bucket/path/alice1.jpg", "https://.../alice2.jpg"]
}
```

Security note: Do NOT ship service-account JSON files with apps. For production, run Firebase-admin operations
on a trusted server and provide the device with signed URLs or an authentication-safe API.

## What `helpers.py` provides

- `load_known_faces(known_faces_dir='known_faces', encodings_cache=None)` — returns `(encodings, names)`.
- `draw_text_bg(...)` — draws readable labels with a background box on frames.
- `read_last_attendance(n=5)` — returns last N attendance lines.
- `mark_attendance(name)` — appends a line to `attendance.csv`.

## Troubleshooting

- dlib build errors on Windows

  - Use conda (recommended) to get prebuilt `dlib` packages from conda-forge.
  - If you must use pip: install CMake and Visual Studio Build Tools (MSVC) first.

- Camera fails to open

  - Make sure no other app is holding the camera. Try using camera index `1` or `2` in `cv2.VideoCapture(1)`.

- Known face not found / encodings empty
  - Ensure your `known_faces/` images contain a clear, front-facing face. If an image has no detectable face it will be skipped.
  - Delete `known_faces/encodings.pickle` to force re-encoding.

## Recommended next steps (optional)

- Add a small server to perform secure Firebase admin operations (signed upload URLs, centralized enrollment).
- Implement threaded capture and process-every-Nth-frame to reduce UI latency.
- Add basic unit tests for `helpers.load_known_faces` and CI to run them.

## License & attribution

- This project builds on `face_recognition` (dlib) and OpenCV. Check their licenses for redistribution concerns.

---

If you'd like I can add a short `environment.yml` for conda reproducibility, implement threaded capture, or add a CLI `--rebuild` flag that deletes the cache for you. Which would you prefer next?

# Facial-Recognition-For-Attendance

This is the facial recognition code for the BuddyWheels school attendance system.

## Files you should commit to GitHub

Commit these repository files (they are source, docs and tooling). They are NOT generated by running the programs:

- main.py
- main_firestore.py
- enroll_admin.py
- helpers.py
- firebase_utils.py
- seed_students_with_encodings.py
- requirements.txt
- README.md
- .gitignore

Do NOT commit these (generated or large):

- venv/ (virtual environment)
- known_faces/ (student images and enrollments)
- enrollments/ (captured enrollment images)
- attendance.csv (local runtime log)
- **pycache**/, _.pyc, _.pkl

If you want a minimal repo for sharing, remove large image folders and keep a small set of sample images (or a README note describing how to add them).

---

## Quick push instructions

From the repo root run (PowerShell):

```powershell
git add main.py main_firestore.py enroll_admin.py helpers.py firebase_utils.py seed_students_with_encodings.py requirements.txt README.md .gitignore
git commit -m "chore: add core app files and seeders"
# if you haven't configured a remote yet:
# git remote add origin <GIT_URL>
git push -u origin main
```

If you prefer I can run these git steps for you (I'll check if `origin` exists and push); otherwise run the commands above locally.
