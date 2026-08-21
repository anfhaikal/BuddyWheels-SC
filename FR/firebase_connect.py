import firebase_admin
from firebase_admin import credentials, firestore

def init_firebase():
    # Load the service account key
    cred = credentials.Certificate("serviceAccountKey.json")
    # Initialize only once
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    return firestore.client()
