import face_recognition
import cv2
import numpy as np
from firebase_connect import init_firebase
from datetime import datetime
import pytz

# Initialize Firestore
db = init_firebase()

print("[INFO] Fetching student face encodings from Firestore...")
students_ref = db.collection("students")
docs = students_ref.stream()

known_encodings = []
known_ids = []
known_names = []

# Load all student encodings from Firestore
for doc in docs:
    student_data = doc.to_dict()
    if "face_encoding" in student_data and student_data["face_encoding"]:
        known_encodings.append(np.array(student_data["face_encoding"]))
        known_ids.append(doc.id)
        known_names.append(student_data.get("name", "Unknown"))

print(f"[INFO] Loaded {len(known_encodings)} student encodings from Firestore.")

if len(known_encodings) == 0:
    print("[ERROR] No face encodings found in Firestore. Please register faces first.")
    exit()

# Initialize camera
video_capture = cv2.VideoCapture(0)

# Request smoother FPS (best effort)
video_capture.set(cv2.CAP_PROP_FPS, 30)

# Optional but recommended: lower resolution for stability
video_capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
video_capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
if not video_capture.isOpened():
    print("[ERROR] Could not access camera.")
    exit()

print("[INFO] Starting face recognition... Press 'Q' to quit.")

malaysia_tz = pytz.timezone("Asia/Kuala_Lumpur")

while True:
    ret, frame = video_capture.read()
    if not ret:
        print("[ERROR] Failed to capture frame.")
        break

    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # Detect faces
    face_locations = face_recognition.face_locations(rgb_frame)
    face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

    for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
        # Compare with known encodings
        distances = face_recognition.face_distance(known_encodings, face_encoding)
        min_distance = np.min(distances) if len(distances) > 0 else 1.0

        if len(distances) > 0 and min_distance < 0.45:
            match_index = np.argmin(distances)
            name = known_names[match_index]
            student_id = known_ids[match_index]

            # Fetch classID from student's document
            student_doc = db.collection("students").document(student_id).get()
            class_id = student_doc.to_dict().get("classID", "Unknown") if student_doc.exists else "Unknown"

            color = (0, 255, 0)
            label = f"{name} ({student_id})"
            print(f"[MATCH] {name} ({student_id}) — Distance: {min_distance:.3f}")

            # --- Save attendance to Firestore ---
            now = datetime.now(malaysia_tz)
            date_str = now.strftime("%Y-%m-%d")
            timestamp = now.strftime("%Y-%m-%d %H:%M:%S")

            doc_id = f"{date_str}_{student_id}"
            attendance_ref = db.collection("attendance").document(doc_id)

            attendance_ref.set({
                "studentID": student_id,
                "name": name,
                "classID": class_id,
                "date": date_str,
                "status": 1,  # Present
                "timestamp": timestamp
            }, merge=True)

            print(f"[INFO] Attendance recorded for {name} ({student_id}) in class {class_id} at {timestamp}")

        else:
            name = "Unknown"
            student_id = ""
            color = (0, 0, 255)
            label = "Unknown"

        # Draw bounding box and label
        cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
        cv2.putText(frame, label, (left, top - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    # Display camera feed
    cv2.imshow("Face Recognition (Firestore)", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        print("[INFO] Recognition stopped by user.")
        break

video_capture.release()
cv2.destroyAllWindows()
