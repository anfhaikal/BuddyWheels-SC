from ultralytics import YOLO
import cv2
import easyocr
from util import clean_plate_text
import re
from firebase_connect import init_firebase
from datetime import datetime
import pytz

# Initialize Firestore
db = init_firebase()
print("[INFO] Firebase initialized successfully!")

def detect_highest_confidence_box(results):
    """Return bounding box with the highest confidence score, or None if empty."""
    if len(results.boxes) == 0:
        return None
    return max(results.boxes, key=lambda x: float(x.conf))

def crop_image(frame, box):
    """Crop a region from the frame using a YOLO bounding box."""
    x1, y1, x2, y2 = map(int, box.xyxy[0])
    return frame[y1:y2, x1:x2], x1, y1

def correct_ocr_errors(plate_text):
    """
    Correct common OCR errors in Malaysian license plates.
    
    Malaysian plates start with letters (not numbers), so:
    - O at the start → Q (common OCR confusion)
    - I at the start → J or leave as I (I is valid in some states)
    - 0 (zero) at the start → Q
    - Other common corrections based on position
    """
    if not plate_text or len(plate_text) == 0:
        return plate_text
    
    corrected = plate_text
    
    # Rule 1: First character should be a letter
    # If it's 'O' or '0', change to 'Q'
    if corrected[0] in ['O', '0']:
        corrected = 'Q' + corrected[1:]
        print(f"    🔧 Corrected: '{plate_text[0]}' → 'Q' at position 0")
    
    # Rule 2: If first character is 'I', it might be '1' or could be valid 'I'
    # We'll leave 'I' as is since some Malaysian states use 'I'
    # But if you want to change it to '1', uncomment below:
    # if corrected[0] == 'I':
    #     corrected = '1' + corrected[1:]
    #     print(f"    🔧 Corrected: 'I' → '1' at position 0")
    
    # Rule 3: Common letter/number confusions in the middle
    # After the first 1-3 letters, we expect numbers
    # This is more complex - we need to identify where letters end and numbers begin
    
    # Find where the numeric part likely starts (after 1-3 letters)
    letter_count = 0
    for i, char in enumerate(corrected):
        if char.isalpha():
            letter_count += 1
        else:
            break
    
    # If we have 1-3 letters at start, the rest should be numbers (with possible letter at end)
    if 1 <= letter_count <= 3 and len(corrected) > letter_count:
        # Check the numeric section (between letters and possible ending letter)
        numeric_section_start = letter_count
        numeric_section_end = len(corrected)
        
        # Check if last character is a letter (valid in some formats like WA4355S)
        if corrected[-1].isalpha():
            numeric_section_end = len(corrected) - 1
        
        # Correct common OCR errors in the numeric section
        new_corrected = corrected[:numeric_section_start]
        for i in range(numeric_section_start, numeric_section_end):
            char = corrected[i]
            # In numeric section, O should be 0, I should be 1
            if char == 'O':
                new_corrected += '0'
                print(f"    🔧 Corrected: 'O' → '0' at position {i}")
            elif char == 'I':
                new_corrected += '1'
                print(f"    🔧 Corrected: 'I' → '1' at position {i}")
            elif char == 'Z':
                new_corrected += '2'
                print(f"    🔧 Corrected: 'Z' → '2' at position {i}")
            elif char == 'S':
                # S could be 5, but only if it's in numeric section and not at the end
                if i < numeric_section_end - 1:
                    new_corrected += '5'
                    print(f"    🔧 Corrected: 'S' → '5' at position {i}")
                else:
                    new_corrected += char
            else:
                new_corrected += char
        
        # Add the ending letter if it exists
        if numeric_section_end < len(corrected):
            new_corrected += corrected[numeric_section_end:]
        
        corrected = new_corrected
    
    # Rule 4: In the letter section at end (if exists), 0 should be O
    if len(corrected) > 4 and corrected[-1].isdigit():
        # Last char is digit but might be meant to be letter
        # Only correct if the pattern suggests it (e.g., WA4355S pattern)
        pass  # Keep as is for now
    
    return corrected

def is_valid_malaysian_plate(text):
    """
    Validate if text matches Malaysian license plate patterns.
    Common formats:
    - ABC1234 (3 letters + 4 digits)
    - AB1234C (2 letters + 4 digits + 1 letter)
    - A1234BC (1 letter + 4 digits + 2 letters)
    - WA4355S (2 letters + 4 digits + 1 letter)
    """
    text = text.replace(" ", "").upper()
    
    # Malaysian plate patterns
    patterns = [
        r'^[A-Z]{1,3}\d{1,4}[A-Z]?$',      # ABC1234 or ABC1234A
        r'^[A-Z]{2}\d{4}[A-Z]$',           # WA4355S format
        r'^[A-Z]\d{1,4}[A-Z]{1,2}$',       # A1234BC format
        r'^[A-Z]{3}\d{1,4}$',              # ABC1234 format
        r'^[A-Z]{1,2}\d{1,4}$',            # Shorter formats
    ]
    
    return any(re.match(pattern, text) for pattern in patterns)

def update_pickup_status(plate_number):
    """
    Check if plate_number matches any pickup with status "On the way"
    and update it to "Arrived" if found.
    """
    try:
        malaysia_tz = pytz.timezone("Asia/Kuala_Lumpur")
        now = datetime.now(malaysia_tz)
        timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
        
        # Query pickups collection for matching plate number with status "On the way"
        pickups_ref = db.collection("pickups")
        query = pickups_ref.where("plateNumber", "==", plate_number).where("status", "==", "Arrived")
        docs = query.stream()
        
        updated = False
        for doc in docs:
            # Update the status to "Arrived"
            doc.reference.update({
                "status": "Dismissed",
                "DismissedTimestamp": timestamp
            })
            print(f"🚗 [PICKUP UPDATED] Plate {plate_number} - Status changed to 'Arrived' at {timestamp}")
            updated = True
        
        return updated
    except Exception as e:
        print(f"❌ [ERROR] Failed to update pickup status: {e}")
        return False

def extract_plate_number_multiline(ocr_results, plate_crop_height, plate_crop_width):
    """
    Extract plate number handling both single-line and two-line formats.
    Filters out dealer/brand text and combines multiple lines correctly.
    """
    if not ocr_results:
        return None
    
    # More lenient threshold - only filter bottom 25% for dealer text
    threshold_y = plate_crop_height * 0.75
    
    # List of common dealer/brand keywords to filter out
    dealer_keywords = ['TOYOTA', 'MOTOR', 'UMW', 'PERODUA', 'HONDA', 'PROTON', 
                       'NISSAN', 'MAZDA', 'MITSUBISHI', 'FORD', 'BMW', 'MERCEDES',
                       'HYUNDAI', 'KIA', 'VOLKSWAGEN', 'AUDI', 'LEXUS', 'CHEVROLET', 
                       'VM', 'TQYQTA', 'MQTQR', 'BENZ', 'VOLVO', 'SUBARU']
    
    valid_detections = []
    
    for detection in ocr_results:
        bbox = detection[0]
        text = clean_plate_text(detection[1]).upper()
        confidence = detection[2]
        
        # Calculate average Y coordinate (vertical position)
        avg_y = sum([point[1] for point in bbox]) / 4
        
        # Calculate average X coordinate (horizontal position)
        avg_x = sum([point[0] for point in bbox]) / 4
        
        # Filter 1: Skip text in bottom portion (dealer text area)
        if avg_y >= threshold_y:
            continue
        
        # Clean the text first
        text_clean = text.replace(" ", "").replace("-", "").replace(".", "")
        
        # Filter 2: Skip dealer/brand keywords (check before cleaning too)
        is_dealer = False
        for keyword in dealer_keywords:
            if keyword in text or keyword in text_clean:
                is_dealer = True
                break
        if is_dealer:
            continue
        
        # Filter 3: Validate text length (be more lenient - accept 1-8 characters per detection)
        if len(text_clean) < 1 or len(text_clean) > 8:
            continue
        
        # Filter 4: Must contain at least one alphanumeric character
        if not any(c.isalnum() for c in text_clean):
            continue
        
        # Filter 5: Skip if it's just a single non-alphanumeric character
        if len(text_clean) == 1 and not text_clean.isalnum():
            continue
        
        valid_detections.append({
            'text': text_clean,
            'y_pos': avg_y,
            'x_pos': avg_x,
            'confidence': confidence,
            'bbox': bbox
        })
    
    if not valid_detections:
        return None
    
    # Group detections into lines based on Y position
    lines = []
    y_threshold = plate_crop_height * 0.2  # 20% height difference = different line
    
    for detection in sorted(valid_detections, key=lambda x: x['y_pos']):
        placed = False
        for line in lines:
            # Check if this detection belongs to an existing line
            if abs(detection['y_pos'] - line[0]['y_pos']) < y_threshold:
                line.append(detection)
                placed = True
                break
        
        if not placed:
            # Create a new line
            lines.append([detection])
    
    # Sort each line by X position (left to right) and combine
    result_parts = []
    for line in lines:
        line.sort(key=lambda x: x['x_pos'])
        line_text = "".join([d['text'] for d in line])
        result_parts.append(line_text)
    
    # Combine all lines (top to bottom)
    plate_number = "".join(result_parts)
    
    # Apply OCR error corrections
    if plate_number:
        print(f"    📝 Before correction: '{plate_number}'")
        plate_number = correct_ocr_errors(plate_number)
        print(f"    ✨ After correction: '{plate_number}'")
    
    # Final validation: check if it matches Malaysian plate format
    if plate_number and is_valid_malaysian_plate(plate_number):
        return plate_number
    elif plate_number:
        # If it doesn't match but we have text, still return it
        # (might be a valid plate in an uncommon format)
        return plate_number
    
    return None

def main():
    # Initialize EasyOCR and YOLO models
    print("Loading models...")
    reader = easyocr.Reader(['en'], gpu=True)  # Set gpu=False if no GPU available
    car_model = YOLO("C:/Users/haika/Documents/IIUM DEGREE/FYP/tryANPR/model/best_vm.pt")
    plate_model = YOLO("C:/Users/haika/Documents/IIUM DEGREE/FYP/tryANPR/model/best_pm.pt")
    print("Models loaded successfully!")

    video_path = "C:/Users/haika/Desktop/Downloads/0710(15).mp4"
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print("Error: Could not open video file")
        return

    # Get video properties
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Video properties: {frame_width}x{frame_height} @ {fps}fps, Total frames: {total_frames}")

    # Output video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter('output_video_fixed.mp4', fourcc, fps,
                          (frame_width, frame_height))

    frame_count = 0
    plates_detected = 0
    
    # Track which plates have already been processed to avoid duplicate updates
    processed_plates = set()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        
        # Print progress every 30 frames
        if frame_count % 30 == 0:
            print(f"Processing frame {frame_count}/{total_frames}")

        # --- Step 1: Detect the most confident vehicle ---
        car_results = car_model(frame)[0]
        best_car = detect_highest_confidence_box(car_results)
        
        if best_car:
            car_crop, car_x, car_y = crop_image(frame, best_car)

            # Draw car box
            x1, y1 = car_x, car_y
            x2, y2 = x1 + car_crop.shape[1], y1 + car_crop.shape[0]
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            
            # Add label for car
            cv2.putText(frame, f"Vehicle {float(best_car.conf):.2f}", (x1, y1-10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

            # --- Step 2: Detect the most confident plate inside the vehicle ---
            plate_results = plate_model(car_crop)[0]
            best_plate = detect_highest_confidence_box(plate_results)
            
            if best_plate:
                plate_crop, plate_x, plate_y = crop_image(car_crop, best_plate)
                
                # Get plate confidence
                plate_confidence = float(best_plate.conf)

                # Draw plate box
                px1 = x1 + plate_x
                py1 = y1 + plate_y
                px2 = px1 + plate_crop.shape[1]
                py2 = py1 + plate_crop.shape[0]
                cv2.rectangle(frame, (px1, py1), (px2, py2), (0, 0, 255), 2)
                
                # Add plate confidence label next to the box
                conf_text = f"{plate_confidence*100:.1f}%"
                cv2.putText(frame, conf_text, (px2 + 5, py1 + 20),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

                # --- Step 3: OCR with filtering ---
                ocr_results = reader.readtext(plate_crop)
                
                # Debug: Print all OCR detections for this frame
                if ocr_results:
                    print(f"\nFrame {frame_count} - Raw OCR Results:")
                    for idx, detection in enumerate(ocr_results):
                        bbox = detection[0]
                        text = detection[1]
                        conf = detection[2]
                        avg_y = sum([point[1] for point in bbox]) / 4
                        print(f"  Detection {idx}: '{text}' (conf: {conf:.2f}, y_pos: {avg_y:.1f})")
                
                detected_text = extract_plate_number_multiline(
                    ocr_results, 
                    plate_crop.shape[0],
                    plate_crop.shape[1]
                )

                if detected_text:
                    plates_detected += 1
                    
                    # --- NEW: Update pickup status in Firebase ---
                    if detected_text not in processed_plates:
                        if update_pickup_status(detected_text):
                            processed_plates.add(detected_text)
                    
                    # Display the plate number above the plate box
                    # Add background rectangle for better visibility
                    text_size = cv2.getTextSize(detected_text, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)[0]
                    cv2.rectangle(frame, 
                                 (px1, py1 - text_size[1] - 15), 
                                 (px1 + text_size[0] + 10, py1 - 5),
                                 (0, 0, 255), -1)
                    cv2.putText(frame, detected_text, (px1 + 5, py1 - 10),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
                    
                    # Print detected plate to console
                    print(f"✓ Frame {frame_count}: Detected plate - {detected_text} (Plate confidence: {plate_confidence*100:.1f}%)")
                else:
                    cv2.putText(frame, "No Text", (px1, py1 - 10),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                    print(f"✗ Frame {frame_count}: No valid plate text detected (Plate confidence: {plate_confidence*100:.1f}%)")

        # Resize for preview (optional, comment out if not needed)
        preview_width = 900
        scale = preview_width / frame.shape[1]
        frame_preview = cv2.resize(frame, (preview_width, int(frame.shape[0] * scale)))
        cv2.imshow("ANPR Video - Press 'q' to quit", frame_preview)
        
        # Write frame to output video
        out.write(frame)

        # Press 'q' to quit, 'p' to pause
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            print("Quitting...")
            break
        elif key == ord('p'):
            print("Paused. Press any key to continue...")
            cv2.waitKey(0)

    # Cleanup
    cap.release()
    out.release()
    cv2.destroyAllWindows()
    
    print(f"\nProcessing complete!")
    print(f"Total frames processed: {frame_count}")
    print(f"Plates detected: {plates_detected}")
    print(f"Unique plates processed: {len(processed_plates)}")
    print(f"Output saved to: output_video_fixed.mp4")

if __name__ == "__main__":
    main()