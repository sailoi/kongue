# Self-Hosting Kongue

Run your own instance of Kongue with **all premium features unlocked** for free! 🚀

## 📋 Overview

When self-hosting, you get:
- ✅ All premium features (TTS, AI chat, etc.)
- ✅ No subscription required
- ✅ Full control over your data
- ✅ Unlimited usage (pay only for API costs)

You'll need to provide your own:
- Google Cloud account (for TTS)
- OpenAI/Anthropic account (for AI features)
- Server (optional - for backend hosting)

## 💰 Cost Estimate

### API Costs (Pay-as-you-go)
- **Google Cloud TTS**: ~$4 per 1 million characters
  - Example: 100 lessons/day ≈ $0.50/month
- **OpenAI GPT-4**: ~$0.03 per 1K tokens
  - Example: 30 conversations/month ≈ $5-10/month
- **Server Hosting** (optional): $5-20/month
  - DigitalOcean, AWS, or Google Cloud Run

**Total**: ~$10-30/month depending on usage

## 🚀 Quick Start

### Option 1: Frontend Only (Easiest)

Use our hosted backend but run the app locally:

```bash
# 1. Clone and install
git clone https://github.com/sailoi/language-learning-app.git
cd language-learning-app
npm install

# 2. Use default config (points to our API)
npx expo start

# You'll have free features only
# Premium features require self-hosting the backend
```

### Option 2: Full Self-Hosting (All Features)

Host both frontend and backend with your own API keys:

## 📦 Prerequisites

### Required
- Node.js 18+ and npm
- Python 3.9+
- Google Cloud account
- Expo CLI: `npm install -g expo-cli`

### Optional (for full deployment)
- Docker & Docker Compose
- Domain name
- SSL certificate (Let's Encrypt)

## 🔧 Backend Setup

### 1. Google Cloud Setup

#### Create Project
```bash
# Install gcloud CLI
# https://cloud.google.com/sdk/docs/install

# Login and create project
gcloud auth login
gcloud projects create my-kongue-app --name="Kongue"
gcloud config set project my-kongue-app
```

#### Enable APIs
```bash
# Enable required APIs
gcloud services enable texttospeech.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable run.googleapis.com
```

#### Create Service Account
```bash
# Create service account
gcloud iam service-accounts create lang-app-sa \
    --display-name="Language App Service Account"

# Get service account email
export SA_EMAIL=$(gcloud iam service-accounts list \
    --filter="name:lang-app-sa" \
    --format="value(email)")

echo $SA_EMAIL
```

#### Grant Permissions
```bash
# Grant TTS permissions
gcloud projects add-iam-policy-binding my-lang-app \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/cloudtexttospeech.client"

# Grant Storage permissions
gcloud projects add-iam-policy-binding my-lang-app \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/storage.objectAdmin"

# Grant token creator (for signed URLs)
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/iam.serviceAccountTokenCreator"
```

#### Create Storage Bucket
```bash
# Create bucket for audio files
gcloud storage buckets create gs://my-lang-app-audio \
    --location=us-central1

# Grant service account access
gcloud storage buckets add-iam-policy-binding gs://my-lang-app-audio \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/storage.objectAdmin"
```

#### Download Credentials
```bash
# Create and download service account key
gcloud iam service-accounts keys create ~/lang-app-credentials.json \
    --iam-account=$SA_EMAIL

# Keep this file secure!
```

### 2. Backend Configuration

```bash
cd server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

Edit `server/.env`:
```bash
# API Security - Generate a random key
API_KEY=your-secure-random-key-here

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=../lang-app-credentials.json
GCS_BUCKET_NAME=my-lang-app-audio
SERVICE_ACCOUNT_EMAIL=lang-app-sa@my-lang-app.iam.gserviceaccount.com

# Server
PORT=8000
ENVIRONMENT=production
```

### 3. Run Backend Locally

```bash
# Development mode
cd server
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Test it
curl http://localhost:8000/
# Should return: {"message":"Text-to-Speech API is running"}
```

### 4. Deploy Backend to Cloud Run (Optional)

```bash
cd server

# Build and deploy
gcloud run deploy lang-app-backend \
    --source . \
    --service-account=$SA_EMAIL \
    --allow-unauthenticated \
    --region=us-central1 \
    --set-env-vars="API_KEY=your-key,GCS_BUCKET_NAME=my-lang-app-audio,SERVICE_ACCOUNT_EMAIL=$SA_EMAIL"

# Get the URL
gcloud run services describe lang-app-backend \
    --region=us-central1 \
    --format="value(status.url)"
```

## 📱 Frontend Setup

### 1. Configure App

```bash
# Copy environment template
cp .env.example .env
```

Edit `.env`:
```bash
# For local backend
EXPO_PUBLIC_API_URL=http://localhost:8000/api/speech
EXPO_PUBLIC_API_KEY=your-secure-random-key-here

# OR for Cloud Run backend
EXPO_PUBLIC_API_URL=https://lang-app-backend-xxx.run.app/api/speech
EXPO_PUBLIC_API_KEY=your-secure-random-key-here
```

### 2. Run the App

```bash
# Start Expo
npx expo start

# Scan QR code with Expo Go app (iOS/Android)
# Or press 'i' for iOS simulator
# Or press 'a' for Android emulator
```

### 3. Test Premium Features

All premium features should now work:
- 🔊 Text-to-Speech
- 🤖 AI Conversations (when implemented)
- 📥 Offline audio download

## 🐳 Docker Deployment (Alternative)

### Using Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./server
    ports:
      - "8000:8000"
    environment:
      - API_KEY=${API_KEY}
      - GCS_BUCKET_NAME=${GCS_BUCKET_NAME}
      - SERVICE_ACCOUNT_EMAIL=${SERVICE_ACCOUNT_EMAIL}
    volumes:
      - ./lang-app-credentials.json:/app/credentials.json
    env_file:
      - ./server/.env
```

Run:
```bash
docker-compose up -d
```

## 🔒 Security Best Practices

### 1. API Key Security
```bash
# Generate a secure random key
openssl rand -hex 32

# Use it in your .env file
API_KEY=generated_key_here
```

### 2. Protect Credentials
```bash
# NEVER commit credentials
# Make sure they're in .gitignore
echo "*.json" >> .gitignore
echo ".env" >> .gitignore
```

### 3. Restrict API Access (Optional)
Add IP whitelisting or rate limiting to your backend.

## 🧪 Testing Your Setup

### 1. Test Backend
```bash
# Test health endpoint
curl http://localhost:8000/

# Test TTS endpoint
curl -X POST http://localhost:8000/api/speech \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-api-key" \
  -d '{"text":"Hello world","gender":"female","language":"spanish"}'
```

### 2. Test Frontend
- Open the app
- Navigate to any lesson
- Tap the speaker icon
- Should hear audio pronunciation

## 🐛 Troubleshooting

### "Invalid API Key" Error
- Check `.env` file has correct `API_KEY`
- Ensure frontend and backend use same key
- Restart Expo: `r` in terminal

### "Google Cloud Storage not configured"
- Verify `GOOGLE_APPLICATION_CREDENTIALS` path
- Check service account has storage permissions
- Ensure bucket exists

### "signBlob permission denied"
- Run: `./server/fix-permissions.sh`
- Or grant manually (see Backend Setup step 4)

### Audio Not Playing
- Check network connectivity
- Verify backend is running
- Check browser/app console for errors

## 📊 Monitoring Costs

### Google Cloud
```bash
# Check current month costs
gcloud billing accounts list

# View detailed billing
# https://console.cloud.google.com/billing
```

### Set Budget Alerts
```bash
# Create budget to avoid surprises
gcloud billing budgets create \
    --billing-account=BILLING_ACCOUNT_ID \
    --display-name="Lang App Budget" \
    --budget-amount=50USD
```

## 🔄 Updating

```bash
# Pull latest changes
git pull upstream main

# Update backend
cd server
source venv/bin/activate
pip install -r requirements.txt --upgrade

# Update frontend
npm install

# Restart services
```

## 💡 Tips for Production

1. **Use Secret Manager** instead of .env files
2. **Enable Cloud CDN** for faster audio delivery
3. **Set up monitoring** (Cloud Monitoring)
4. **Configure auto-scaling** (Cloud Run does this by default)
5. **Use Cloud Build** for CI/CD
6. **Enable logging** for debugging

## 📞 Need Help?

- 📖 [Google Cloud TTS Docs](https://cloud.google.com/text-to-speech/docs)
- 📖 [Expo Docs](https://docs.expo.dev/)
- 💬 [GitHub Discussions](https://github.com/sailoi/language-learning-app/discussions)
- 🐛 [Report Issues](https://github.com/sailoi/language-learning-app/issues)

## 🎉 Success!

Congratulations! You now have Kongue fully functional with all premium features unlocked, running on your own infrastructure! 🚀

---

**Happy Learning!** 📚✨
