from fastapi import FastAPI, Depends, HTTPException, status, Header, UploadFile, File, Form
import firebase_admin
from firebase_admin import auth as firebase_auth
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import os
import hashlib
import datetime
import base64
import json
from typing import Optional
from google.cloud import texttospeech
from google.cloud import storage
from google.cloud import firestore
import google.auth
from google.auth import impersonated_credentials
from google.auth.transport import requests as google_requests
import vertexai
from vertexai.generative_models import GenerativeModel, Part, Content
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- Firebase Admin ---
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
if not FIREBASE_PROJECT_ID:
    raise ValueError("FIREBASE_PROJECT_ID environment variable must be set")
if not firebase_admin._apps:
    firebase_admin.initialize_app(options={'projectId': FIREBASE_PROJECT_ID})


GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")
if not GCS_BUCKET_NAME:
    raise ValueError("GCS_BUCKET_NAME environment variable must be set")

GEMINI_MODEL = "gemini-2.5-flash-lite"

async def verify_firebase_token(authorization: Optional[str] = Header(None)) -> str:
    """Dependency to verify Firebase ID token and return the uid."""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header")
    token = authorization.split(' ', 1)[1]
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded['uid']
    except Exception as e:
        print(f"Token verification failed: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


# --- Google Cloud Clients ---
# When running on Google Cloud, authentication is handled automatically
# via the service account associated with the Cloud Run service.
try:
    tts_client = texttospeech.TextToSpeechClient()
    storage_client = storage.Client()
    bucket = storage_client.bucket(GCS_BUCKET_NAME)

    # Get default credentials for IAM-based signing
    credentials, project = google.auth.default()

    db = firestore.Client(project=project, database='kongue')

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
    storage_client = None
    bucket = None
    signing_credentials = None
    project = None
    db = None


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


@app.get("/", response_class=HTMLResponse)
def landing_page():
    year = datetime.datetime.now().year
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kongue — Learn to speak, naturally</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(150deg, #ffffff 0%, #f4faed 50%, #eaf5d8 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f1f2f;
      padding: 40px 24px;
    }

    .card {
      background: #ffffff;
      border-radius: 32px;
      padding: 56px 48px;
      max-width: 560px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(15, 31, 47, 0.08), 0 1px 4px rgba(15, 31, 47, 0.04);
    }

    .icon {
      width: 88px;
      height: 88px;
      border-radius: 20px;
      margin: 0 auto 24px;
      display: block;
      box-shadow: 0 8px 24px rgba(140, 198, 63, 0.3);
    }

    .badge {
      display: inline-block;
      background: #8cc63f;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      padding: 5px 16px;
      border-radius: 100px;
      margin-bottom: 18px;
    }

    h1 {
      font-size: 52px;
      font-weight: 800;
      letter-spacing: -2px;
      color: #0f1f2f;
      margin-bottom: 10px;
      line-height: 1.1;
    }

    h1 span { color: #8cc63f; }

    .tagline {
      font-size: 17px;
      color: #1a2a3a;
      opacity: 0.55;
      line-height: 1.6;
      margin-bottom: 32px;
      font-weight: 400;
    }

    .divider {
      width: 40px;
      height: 3px;
      background: #8cc63f;
      border-radius: 2px;
      margin: 0 auto 32px;
    }

    .features {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 36px;
      text-align: left;
    }

    .feature {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }

    .feature-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #8cc63f;
      flex-shrink: 0;
      margin-top: 6px;
    }

    .feature p {
      font-size: 14px;
      color: #1a2a3a;
      line-height: 1.65;
      opacity: 0.75;
    }

    .feature p a {
      color: #8cc63f;
      text-decoration: none;
      font-weight: 600;
    }

    .feature p a:hover { text-decoration: underline; }

    .feature-note {
      font-size: 12px;
      opacity: 0.5;
      margin-top: 3px;
      display: block;
    }

    .stores {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }

    .store-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 11px 20px;
      border-radius: 12px;
      border: 1.5px solid rgba(15, 31, 47, 0.12);
      background: #ffffff;
      color: #0f1f2f;
      font-size: 13px;
      font-weight: 600;
      cursor: default;
      opacity: 0.4;
      text-decoration: none;
    }

    .github-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 11px 22px;
      border-radius: 12px;
      background: #0f1f2f;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.2s;
    }

    .github-btn:hover { opacity: 0.85; }

    .btn-row {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .store-icon { width: 15px; height: 15px; flex-shrink: 0; }

    .footer {
      margin-top: 40px;
      font-size: 13px;
      color: #1a2a3a;
      opacity: 0.35;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="/static/icon.png" alt="Kongue icon" class="icon" />
    <div class="badge">Coming Soon</div>
    <h1>Kong<span>ue</span></h1>
    <p class="tagline">Learn to speak foreign languages, naturally.</p>
    <div class="divider"></div>

    <div class="features">
      <div class="feature">
        <div class="feature-dot"></div>
        <p>An <strong>open-source</strong> dialogue-based language learning app. Practice real conversations and build fluency through natural interactions.</p>
      </div>
      <div class="feature">
        <div class="feature-dot"></div>
        <p><strong>Free to download</strong> from the iOS App Store and Google Play. No paywalls for lessons — just install and start learning.</p>
      </div>
      <div class="feature">
        <div class="feature-dot"></div>
        <p><strong>Community-driven.</strong> More languages and lessons can be added at <a href="https://github.com/sailoi/kongue/tree/main/assets/categories" target="_blank">github.com/sailoi/kongue</a>. Submit a PR — approved contributions get shipped to the stores.
        <span class="feature-note">Want to add French, Japanese, or more Spanish lessons? Fork, add, and open a PR.</span></p>
      </div>
      <div class="feature">
        <div class="feature-dot"></div>
        <p><strong>Always free</strong> for reading and listening lessons. AI voice conversation practice uses AI tokens, so a small subscription is available for that feature only.</p>
      </div>
    </div>

    <div class="btn-row">
      <span class="store-btn">
        <svg class="store-icon" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
        App Store
      </span>
      <span class="store-btn">
        <svg class="store-icon" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l235.6-235.6L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c17.4-9.7 17.4-34.4-.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/></svg>
        Google Play
      </span>
      <a class="github-btn" href="https://github.com/sailoi/kongue" target="_blank">
        <svg class="store-icon" viewBox="0 0 496 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8z"/></svg>
        GitHub
      </a>
    </div>
  </div>
  <p class="footer">© {{ year }} Sailoi Labs</p>
</body>
</html>"""
    return html.replace("{{ year }}", str(year))


@app.post("/api/speech", dependencies=[Depends(verify_firebase_token)])
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



@app.post("/api/voice-chat/intro", dependencies=[Depends(verify_firebase_token)])
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

    user_name = ctx.get('userName', '')
    student_ref = f"{user_name}" if user_name else "the student"

    if mode == 'lesson':
        lesson_title = ctx.get('lessonTitle', '')
        lesson_lines = ctx.get('lessonLines', [])
        dialogue_text = '\n'.join(lesson_lines) if lesson_lines else ''
        system_prompt = (
            f"You are a friendly {language} language tutor. "
            f"The student's name is {student_ref}. "
            f"They are about to practice the lesson titled \"{lesson_title}\". "
            f"The lesson dialogue is:\n{dialogue_text}\n\n"
            f"Use only vocabulary and sentence structures found in the lesson dialogue above. Do not introduce new grammar patterns. "
            f"Greet {student_ref} warmly by name, then immediately ask them a question drawn directly from the lesson dialogue to start practicing. Do not explain roles or ask what they want to practice. "
            f"Respond strictly in {language} only. Do not use English. "
            "Keep it to 2 sentences max."
        )
    else:  # freeform
        category_name = ctx.get('categoryName', '')
        dialogue_lines = ctx.get('dialogueLines', [])
        dialogue_summary = '\n'.join(dialogue_lines[:60]) if dialogue_lines else ''
        system_prompt = (
            f"You are a friendly native {language} speaker having a casual real-world conversation with {student_ref}. "
            f"They have been studying \"{category_name}\" vocabulary. "
            f"Here are phrases they know:\n{dialogue_summary}\n\n"
            f"Start a natural conversation related to the {category_name} theme. "
            f"Ask {student_ref} one simple opening question to get them talking. Do not explain or set up the conversation. "
            f"Respond strictly in {language} only. Do not use English. "
            "Keep it to 1-2 sentences."
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


@app.post("/api/voice-chat", dependencies=[Depends(verify_firebase_token)])
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
    if not tts_client:
        raise HTTPException(status_code=500, detail="Google Cloud clients not initialized")

    lang_config = VOICE_LANGUAGE_CONFIG.get(language, VOICE_LANGUAGE_CONFIG['spanish'])

    # --- 1. Speech-to-Text ---
    audio_bytes = await audio.read()

    print(f"Transcription: received {len(audio_bytes)} bytes, content_type={audio.content_type}")

    # Use Gemini for transcription — handles m4a natively, same credentials as everything else
    try:
        audio_part = Part.from_data(data=audio_bytes, mime_type="audio/mp4")
        transcription_model = GenerativeModel(GEMINI_MODEL)
        transcription_response = transcription_model.generate_content([
            audio_part,
            f"Transcribe the speech in this audio. The speaker may be speaking {language} or English. Return only the transcription text, nothing else.",
        ])
        transcript = transcription_response.text.strip()
        print(f"Transcription: '{transcript}'")
    except Exception as t_err:
        print(f"Transcription error: {t_err}")
        raise HTTPException(status_code=500, detail=f"Transcription error: {t_err}")

    if not transcript:
        raise HTTPException(status_code=422, detail="Could not transcribe audio — no speech detected")

    # --- 2. Gemini ---
    try:
        ctx = json.loads(context)
    except Exception:
        ctx = {}

    user_name = ctx.get('userName', '')
    student_ref = f"{user_name}" if user_name else "the student"

    if mode == 'lesson':
        lesson_title = ctx.get('lessonTitle', '')
        lesson_lines = ctx.get('lessonLines', [])
        dialogue_text = '\n'.join(lesson_lines) if lesson_lines else ''
        system_prompt = (
            f"You are a friendly {language} language tutor helping {student_ref} practice "
            f"the lesson titled \"{lesson_title}\". "
            f"The lesson dialogue is:\n{dialogue_text}\n\n"
            f"Use only vocabulary and sentence structures found in the lesson dialogue above. Do not introduce new grammar patterns. "
            f"Drive the conversation naturally — ask questions, respond to {student_ref}'s answers, and guide them to practice both sides of the lesson dialogue across the conversation. Never explain roles or ask what they want to do. "
            f"If {student_ref} makes an error, gently rephrase their sentence correctly in your reply without explicitly pointing it out. "
            f"Address {student_ref} by name occasionally. "
            f"Keep responses to 1-2 short sentences. Respond strictly in {language} only. Do not use English. "
            "Be warm and encouraging."
        )
    else:  # freeform
        category_name = ctx.get('categoryName', '')
        dialogue_lines = ctx.get('dialogueLines', [])
        dialogue_summary = '\n'.join(dialogue_lines[:60]) if dialogue_lines else ''
        system_prompt = (
            f"You are a friendly native {language} speaker having a casual real-world conversation with {student_ref}. "
            f"They have been studying \"{category_name}\" vocabulary. Here are phrases they know:\n{dialogue_summary}\n\n"
            f"Have a natural, flowing conversation on the {category_name} theme. "
            f"Do not drill or repeat lesson phrases mechanically — just talk naturally. "
            f"If {student_ref} makes an error, weave the correct form naturally into your response without pointing it out. "
            f"Address {student_ref} by name occasionally. "
            f"Keep responses to 1-2 sentences. Respond strictly in {language} only. Do not use English. "
            "Be friendly and conversational."
        )

    # Build chat history from previous turns
    history_raw = ctx.get('history', [])
    chat_history = []
    for turn in history_raw:
        role = turn.get('role')  # 'user' or 'ai'
        text = turn.get('text', '')
        if role == 'user':
            chat_history.append(Content(role='user', parts=[Part.from_text(text)]))
        elif role == 'ai':
            chat_history.append(Content(role='model', parts=[Part.from_text(text)]))

    model = GenerativeModel(GEMINI_MODEL, system_instruction=system_prompt)
    chat = model.start_chat(history=chat_history)
    gemini_response = chat.send_message(transcript)
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


@app.post("/api/translate", dependencies=[Depends(verify_firebase_token)])
async def translate(request: TranslateRequest):
    """Translate text to English on demand."""
    model = GenerativeModel(GEMINI_MODEL)
    response = model.generate_content(
        f"Translate the following to English. Reply with only the translation, nothing else.\n\n{request.text}"
    )
    return {"translation": response.text.strip()}


# --- User & Progress (Firestore) ---

class UserProfileRequest(BaseModel):
    user_id: str
    name: str
    language: str = 'spanish'


class ProgressRequest(BaseModel):
    language: str
    category: str
    max_index: int


@app.post("/api/user", dependencies=[Depends(verify_firebase_token)])
async def upsert_user(request: UserProfileRequest):
    """Create or update a user profile."""
    if not db:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    doc_ref = db.collection('users').document(request.user_id)
    doc_ref.set({
        'name': request.name,
        'language': request.language,
        'updatedAt': firestore.SERVER_TIMESTAMP,
    }, merge=True)
    return {"ok": True}


@app.get("/api/user/{user_id}", dependencies=[Depends(verify_firebase_token)])
async def get_user(user_id: str):
    """Get a user's profile and all lesson progress."""
    if not db:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    doc_ref = db.collection('users').document(user_id)
    doc = doc_ref.get()
    if not doc.exists:
        return {"exists": False}
    profile = doc.to_dict()
    progress = {}
    for pdoc in doc_ref.collection('progress').stream():
        progress[pdoc.id] = pdoc.to_dict()
    return {"exists": True, "profile": profile, "progress": progress}


@app.put("/api/user/{user_id}/progress", dependencies=[Depends(verify_firebase_token)])
async def update_progress(user_id: str, request: ProgressRequest):
    """Update lesson progress for a language+category."""
    if not db:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    key = f"{request.language}_{request.category}"
    doc_ref = db.collection('users').document(user_id).collection('progress').document(key)
    doc_ref.set({
        'language': request.language,
        'category': request.category,
        'maxIndex': request.max_index,
        'updatedAt': firestore.SERVER_TIMESTAMP,
    }, merge=True)
    return {"ok": True}
