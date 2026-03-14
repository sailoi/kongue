from fastapi import FastAPI, Depends, HTTPException, status, Header
from pydantic import BaseModel
import os
import hashlib
import datetime
from typing import Optional
from google.cloud import texttospeech
from google.cloud import storage
import google.auth
from google.auth import impersonated_credentials
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# --- Configuration & Security ---
# Load from environment variables
API_KEY = os.getenv("API_KEY", "")
if not API_KEY:
    raise ValueError("API_KEY environment variable must be set")

GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")
if not GCS_BUCKET_NAME:
    raise ValueError("GCS_BUCKET_NAME environment variable must be set")

async def get_api_key(x_api_key: Optional[str] = Header(None)):
    """Dependency to verify the API key."""
    if not x_api_key or x_api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key",
        )
    return x_api_key


# --- Google Cloud Clients ---
# When running on Google Cloud, authentication is handled automatically
# via the service account associated with the Cloud Run service.
try:
    tts_client = texttospeech.TextToSpeechClient()
    storage_client = storage.Client()
    bucket = storage_client.bucket(GCS_BUCKET_NAME)

    # Get default credentials for IAM-based signing
    credentials, project = google.auth.default()
    service_account_email = os.getenv(
        "SERVICE_ACCOUNT_EMAIL",
        ""
    )
    if not service_account_email:
        raise ValueError("SERVICE_ACCOUNT_EMAIL environment variable must be set")

    # Create impersonated credentials for signing
    # This uses the IAM Credentials API to sign without a private key
    signing_credentials = impersonated_credentials.Credentials(
        source_credentials=credentials,
        target_principal=service_account_email,
        target_scopes=["https://www.googleapis.com/auth/cloud-platform"],
        delegates=[],
        lifetime=3600,
    )
except Exception as e:
    print(f"Error initializing Google Cloud clients: {e}")
    tts_client = None
    storage_client = None
    bucket = None
    signing_credentials = None


class SpeechRequest(BaseModel):
    text: str
    gender: str = 'female'  # Default to female
    language: str = 'spanish'  # Default to spanish
    language_code: str = 'es-ES'  # TTS language code


def generate_signed_url(blob) -> str:
    """Generate a signed URL for a GCS blob using IAM-based signing."""
    return blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(minutes=15),
        method="GET",
        credentials=signing_credentials,
        service_account_email=service_account_email,
    )


@app.get("/")
def read_root():
    return {"message": "Text-to-Speech API is running"}


@app.post("/api/speech", dependencies=[Depends(get_api_key)])
async def synthesize_speech(request: SpeechRequest):
    """
    Receives text and returns a signed URL to the synthesized audio file.
    Caches the result in Google Cloud Storage organized by language.
    """
    if not bucket:
        return {"error": "Google Cloud Storage not configured"}, 500

    # Define voices for each language
    language_voices = {
        'spanish': {
            'language_code': 'es-ES',
            'voices': {
                'female': 'es-ES-Wavenet-B',
                'male': 'es-ES-Wavenet-D'
            }
        },
        'turkish': {
            'language_code': 'tr-TR',
            'voices': {
                'female': 'tr-TR-Wavenet-A',
                'male': 'tr-TR-Wavenet-B'
            }
        }
    }

    # Get language config, default to spanish
    lang_config = language_voices.get(request.language, language_voices['spanish'])
    voice_name = lang_config['voices'].get(request.gender, lang_config['voices']['female'])
    language_code = request.language_code or lang_config['language_code']

    # Generate a unique filename based on the request content
    hash_object = hashlib.md5(
        (request.text + language_code + voice_name).encode()
    )
    # Organize files by language in subfolder
    filename = f"{request.language}/{hash_object.hexdigest()}.mp3"
    blob = bucket.blob(filename)

    # Check if the file already exists in the bucket
    if blob.exists():
        signed_url = generate_signed_url(blob)
        return {"audioUrl": signed_url}

    # If not, synthesize the speech
    synthesis_input = texttospeech.SynthesisInput(text=request.text)
    voice = texttospeech.VoiceSelectionParams(
        language_code=request.language_code,
        name=voice_name
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    response = tts_client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    # Upload the audio to Google Cloud Storage
    blob.upload_from_string(response.audio_content, content_type="audio/mpeg")

    signed_url = generate_signed_url(blob)
    return {"audioUrl": signed_url}
