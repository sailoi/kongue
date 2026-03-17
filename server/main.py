from fastapi import FastAPI, Depends, HTTPException, status, Header, UploadFile, File, Form
from pydantic import BaseModel
import os
import hashlib
import datetime
import base64
import json
from typing import Optional
from google.cloud import texttospeech
from google.cloud import storage
from google.cloud import speech
import google.auth
from google.auth import impersonated_credentials
from google.auth.transport import requests as google_requests
import vertexai
from vertexai.generative_models import GenerativeModel
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

GEMINI_MODEL = "gemini-2.5-flash-lite"

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
    stt_client = speech.SpeechClient()
    storage_client = storage.Client()
    bucket = storage_client.bucket(GCS_BUCKET_NAME)

    # Get default credentials for IAM-based signing
    credentials, project = google.auth.default()

    # Initialize Vertex AI with the same service account credentials
    VERTEX_LOCATION = os.getenv("VERTEX_LOCATION", "us-central1")
    vertexai.init(project=project, location=VERTEX_LOCATION, credentials=credentials)
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
    stt_client = None
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


# --- Voice language config ---
VOICE_LANGUAGE_CONFIG = {
    'spanish': {
        'language_code': 'es-ES',
        'stt_code': 'es-ES',
        'tutor_voice': 'es-ES-Wavenet-B',
    },
    'turkish': {
        'language_code': 'tr-TR',
        'stt_code': 'tr-TR',
        'tutor_voice': 'tr-TR-Wavenet-A',
    },
}



@app.post("/api/voice-chat/intro", dependencies=[Depends(get_api_key)])
async def voice_chat_intro(
    language: str = Form('spanish'),
    mode: str = Form('lesson'),
    context: str = Form('{}'),
):
    """
    Generates the AI tutor's opening message when a voice chat session starts.
    No audio input — returns AI text + audio (base64 mp3).
    """
    if not tts_client:
        raise HTTPException(status_code=500, detail="Google Cloud clients not initialized")

    lang_config = VOICE_LANGUAGE_CONFIG.get(language, VOICE_LANGUAGE_CONFIG['spanish'])

    try:
        ctx = json.loads(context)
    except Exception:
        ctx = {}

    if mode == 'lesson':
        lesson_title = ctx.get('lessonTitle', '')
        lesson_lines = ctx.get('lessonLines', [])
        dialogue_text = '\n'.join(lesson_lines) if lesson_lines else ''
        system_prompt = (
            f"You are a friendly {language} language tutor. "
            f"The student is about to practice the lesson titled \"{lesson_title}\". "
            f"The lesson dialogue is:\n{dialogue_text}\n\n"
            f"Greet them warmly and ask one specific opening question drawn from the lesson content. "
            f"Respond in {language}, mixing in English only when it helps clarity. "
            "Keep it to 2 sentences max."
        )
    else:  # progress
        current_category = ctx.get('currentCategory', '')
        completed = ctx.get('completedLessons', 0)
        system_prompt = (
            f"You are a friendly {language} language tutor. "
            f"The student has completed {completed} lessons in the \"{current_category}\" category. "
            f"Greet them and ask one question about their learning experience so far. "
            f"Respond in {language}, mixing in English only when it helps clarity. "
            "Keep it to 2 sentences max."
        )

    model = GenerativeModel(GEMINI_MODEL)
    gemini_response = model.generate_content(system_prompt)
    ai_text = gemini_response.text.strip()

    synthesis_input = texttospeech.SynthesisInput(text=ai_text)
    voice = texttospeech.VoiceSelectionParams(
        language_code=lang_config['language_code'],
        name=lang_config['tutor_voice'],
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )
    tts_response = tts_client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    return {
        "response": ai_text,
        "audio": base64.b64encode(tts_response.audio_content).decode('utf-8'),
    }


@app.post("/api/voice-chat", dependencies=[Depends(get_api_key)])
async def voice_chat(
    audio: UploadFile = File(...),
    language: str = Form('spanish'),
    mode: str = Form('lesson'),
    context: str = Form('{}'),
):
    """
    Voice conversation endpoint.
    Accepts audio + context, returns transcript + AI text response + AI audio (base64 mp3).
    Pipeline: Google STT → Gemini → Google TTS (no GCS caching).
    """
    if not tts_client or not stt_client:
        raise HTTPException(status_code=500, detail="Google Cloud clients not initialized")

    lang_config = VOICE_LANGUAGE_CONFIG.get(language, VOICE_LANGUAGE_CONFIG['spanish'])

    # --- 1. Speech-to-Text ---
    audio_bytes = await audio.read()

    # iOS records WAV (LINEAR16), Android records WEBM (WEBM_OPUS)
    content_type = audio.content_type or ''
    if 'webm' in content_type:
        stt_encoding = speech.RecognitionConfig.AudioEncoding.WEBM_OPUS
        sample_rate = 16000
    else:
        # Default: WAV / LINEAR16 from iOS
        stt_encoding = speech.RecognitionConfig.AudioEncoding.LINEAR16
        sample_rate = 16000

    stt_config = speech.RecognitionConfig(
        encoding=stt_encoding,
        sample_rate_hertz=sample_rate,
        language_code=lang_config['stt_code'],
        alternative_language_codes=['en-US'],
        enable_automatic_punctuation=True,
    )
    stt_audio = speech.RecognitionAudio(content=audio_bytes)
    stt_response = stt_client.recognize(config=stt_config, audio=stt_audio)

    transcript = ""
    for result in stt_response.results:
        transcript += result.alternatives[0].transcript + " "
    transcript = transcript.strip()

    if not transcript:
        raise HTTPException(status_code=422, detail="Could not transcribe audio")

    # --- 2. Gemini ---
    try:
        ctx = json.loads(context)
    except Exception:
        ctx = {}

    if mode == 'lesson':
        lesson_title = ctx.get('lessonTitle', '')
        lesson_lines = ctx.get('lessonLines', [])
        dialogue_text = '\n'.join(lesson_lines) if lesson_lines else ''
        system_prompt = (
            f"You are a friendly {language} language tutor helping a student practice "
            f"the lesson titled \"{lesson_title}\". "
            f"The lesson dialogue is:\n{dialogue_text}\n\n"
            "Answer in 2-3 short sentences. Mix in the target language naturally. "
            "Be encouraging and conversational."
        )
    else:  # progress
        completed = ctx.get('completedLessons', 0)
        total = ctx.get('totalLessons', 0)
        current_category = ctx.get('currentCategory', '')
        system_prompt = (
            f"You are a friendly {language} language tutor reviewing a student's progress. "
            f"The student has completed {completed} of {total} lessons in the \"{current_category}\" category. "
            "Answer in 2-3 short sentences. Be encouraging and give a practical tip."
        )

    model = GenerativeModel(GEMINI_MODEL)
    gemini_response = model.generate_content(
        f"{system_prompt}\n\nStudent said: {transcript}"
    )
    ai_text = gemini_response.text.strip()

    # --- 3. Text-to-Speech (no caching) ---
    synthesis_input = texttospeech.SynthesisInput(text=ai_text)
    voice = texttospeech.VoiceSelectionParams(
        language_code=lang_config['language_code'],
        name=lang_config['tutor_voice'],
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )
    tts_response = tts_client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    audio_base64 = base64.b64encode(tts_response.audio_content).decode('utf-8')

    return {
        "transcript": transcript,
        "response": ai_text,
        "audio": audio_base64,
    }


class TranslateRequest(BaseModel):
    text: str


@app.post("/api/translate", dependencies=[Depends(get_api_key)])
async def translate(request: TranslateRequest):
    """Translate text to English on demand."""
    model = GenerativeModel(GEMINI_MODEL)
    response = model.generate_content(
        f"Translate the following to English. Reply with only the translation, nothing else.\n\n{request.text}"
    )
    return {"translation": response.text.strip()}
