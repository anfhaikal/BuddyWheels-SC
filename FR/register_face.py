import face_recognition
import cv2
import pickle
import os
import numpy as np
from firebase_connect import init_firebase
from google.cloud import exceptions

# Connect to Firestore
db = init_firebase()

ENCODINGS_PATH = "encodings.pkl"

video_capture = cv2.VideoCapture(0)
print("[INFO] Camera started...")

student_id = input("Enter Student ID: ").strip()

# Check if student exists
student_ref = db.collection("students").document(student_id)
doc = student_ref.get()

if not doc.exists:
    print(f"[ERROR] Student ID '{student_id}' does not exist in Firestore.")
    video_capture.release()
    cv2.destroyAllWindows()
    exit()

# ✅ Retrieve student's name from Firestore
student_data = doc.to_dict()
student_name = student_data.get("name", "Unknown")

print(f"[INFO] Student ID '{student_id}' found.")
print(f"[INFO] Student Name: {student_name}")
print("[INFO] You may now scan your face and press 'S' to save.")

while True:
    ret, frame = video_capture.read()
    if not ret:
        print("[ERROR] Failed to capture frame.")
        break

    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    face_locations = face_recognition.face_locations(rgb_frame)
    face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
    print(f"[DEBUG] Detected {len(face_encodings)} face(s).")

    # ✅ Display student's name on camera feed
    for (top, right, bottom, left) in face_locations:
        cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)
        cv2.putText(frame, f"{student_name} ({student_id})", (left, top - 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
        cv2.putText(frame, "Press 'S' to save", (left, top - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    cv2.imshow("Register Face", frame)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('s'):
        print("[INFO] 'S' pressed — attempting to save encoding.")
        if len(face_encodings) > 0:
            encoding = face_encodings[0]

            # Save locally as backup
            data = []
            if os.path.exists(ENCODINGS_PATH) and os.path.getsize(ENCODINGS_PATH) > 0:
                with open(ENCODINGS_PATH, 'rb') as f:
                    data = pickle.load(f)
            data.append({"student_id": student_id, "encoding": encoding})
            with open(ENCODINGS_PATH, 'wb') as f:
                pickle.dump(data, f)

            # ✅ Upload encoding to Firestore
            try:
                student_ref.update({"face_encoding": encoding.tolist()})
                print(f"[SUCCESS] Face encoding uploaded for '{student_name}' ({student_id}).")
            except exceptions.GoogleCloudError as e:
                print(f"[FIRESTORE ERROR] {e}")
            except Exception as e:
                print(f"[ERROR] Could not upload encoding: {e}")

            break
        else:
            print("[WARN] No face detected — please try again.")
    elif key == ord('q'):
        print("[INFO] 'Q' pressed — exiting.")
        break

video_capture.release()
cv2.destroyAllWindows()
