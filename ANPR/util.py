# util.py
import re
from typing import List, Tuple

from difflib import SequenceMatcher

# Forbidden starting letters in Malaysian plates
FORBIDDEN_STARTS = {"E", "G", "H", "I", "O", "U", "X", "Y", "Z"}

# Loose Malaysian plate regex (covers many common formats)
PLATE_REGEX = re.compile(r'^[A-Z]{1,3}\d{1,4}[A-Z]{0,2}$')

def clean_plate_text(raw_text: str) -> str:
    """
    Clean and validate detected plate text according to Malaysian license plate rules.
    """
    if not raw_text:
        return ""

    # 1. Keep only alphanumeric characters
    text = re.sub(r'[^A-Za-z0-9]', '', raw_text).upper()

    # 2. Replace O with Q before removing invalid chars (per your rules)
    text = text.replace("O", "Q")

    # 3. Remove I completely
    text = text.replace("I", "")

    # 4. If first character is forbidden, drop it
    if text and text[0] in FORBIDDEN_STARTS:
        text = text[1:] if len(text) > 1 else ""

    return text


def is_probable_plate(cleaned_text: str,
                      bbox: List[Tuple[float, float]],
                      plate_crop_shape: Tuple[int, int],
                      *,
                      min_length: int = 4,
                      min_ratio_height: float = 0.06,
                      max_bottom_ratio: float = 0.9) -> bool:
    """
    Decide whether an OCR result likely corresponds to the license plate main text.

    Parameters
    - cleaned_text: output from clean_plate_text()
    - bbox: the 4-point bbox returned by EasyOCR for this text (list of 4 (x,y) points)
    - plate_crop_shape: (height, width) of the plate_crop image
    - min_length: minimum number of characters for candidate plate
    - min_ratio_height: minimum bbox height relative to plate_crop height
    - max_bottom_ratio: if the bbox center is lower than this ratio of plate height and the bbox
                        is very small, likely footer -> reject
    """
    if not cleaned_text:
        return False

    # Basic textual checks
    if len(cleaned_text) < min_length:
        return False

    # Must contain at least one letter and one digit (typical of plates)
    if not (re.search(r'[A-Z]', cleaned_text) and re.search(r'\d', cleaned_text)):
        return False

    # Prefer matches to the plate regex, but allow if other heuristics are strong
    if not PLATE_REGEX.match(cleaned_text):
        # If it doesn't match regex, still allow if longer and has letters+digits,
        # but this increases chance of false positives. We keep it conservative:
        return False

    # Now bbox / position heuristics
    # bbox is list of 4 points (x,y) from EasyOCR: [(x1,y1),(x2,y2),(x3,y3),(x4,y4)]
    ys = [p[1] for p in bbox]
    min_y, max_y = min(ys), max(ys)
    bbox_height = max_y - min_y

    plate_h, plate_w = plate_crop_shape[0], plate_crop_shape[1]
    if plate_h <= 0:
        return False

    height_ratio = bbox_height / plate_h

    # Reject very small text (likely footer/dealer text)
    if height_ratio < min_ratio_height:
        return False

    # If center of bbox is very low (bottom area) *and* small, likely footer -> reject
    center_y = sum(ys) / len(ys)
    center_ratio = center_y / plate_h
    if center_ratio > max_bottom_ratio and height_ratio < (min_ratio_height * 1.5):
        return False

    return True


def find_best_match(detected_plate: str, candidates: list, threshold: float = 0.6):
    """
    Returns the best match from candidates using similarity ratio.
    threshold: minimum similarity to consider a match (0.0 to 1.0)
    """
    detected_plate = detected_plate.upper()
    best_match = None
    highest_ratio = 0.0

    for candidate in candidates:
        ratio = SequenceMatcher(None, detected_plate, candidate.upper()).ratio()
        if ratio > highest_ratio:
            highest_ratio = ratio
            best_match = candidate

    if highest_ratio >= threshold:
        return best_match
    return None

