#!/bin/bash

# RealFit AI - Google Cloud Authentication Setup for EAS
# This script helps you create and configure Google Cloud service account credentials
# for use with Expo Application Services (EAS) hosting

set -e  # Exit on any error

PROJECT_ID="realfit-469213"
SERVICE_ACCOUNT_NAME="realfit-api"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="$HOME/realfit-service-account.json"
BASE64_FILE="$HOME/realfit-service-account-base64.txt"

echo "🚀 RealFit AI - Google Cloud Authentication Setup"
echo "================================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "✅ gcloud CLI found"
echo ""

# Check if user is logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "⚠️  You're not logged in to gcloud. Running: gcloud auth login"
    gcloud auth login
fi

ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
echo "✅ Logged in as: $ACTIVE_ACCOUNT"
echo ""

# Set the project
echo "📋 Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

echo ""
echo "Step 1: Creating Service Account"
echo "================================="

# Check if service account already exists
if gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL &> /dev/null; then
    echo "✅ Service account already exists: $SERVICE_ACCOUNT_EMAIL"
else
    echo "Creating service account: $SERVICE_ACCOUNT_EMAIL"
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name="RealFit API Service Account" \
        --description="Service account for RealFit AI API routes on EAS hosting" \
        --project=$PROJECT_ID
    echo "✅ Service account created"
    echo "⏳ Waiting 10 seconds for service account to propagate..."
    sleep 10
fi

echo ""
echo "Step 2: Granting Permissions"
echo "============================="

# Grant AI Platform User role
echo "Granting roles/aiplatform.user permission..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/aiplatform.user" \
    > /dev/null 2>&1 || {
    echo "⚠️  First attempt failed (service account may still be propagating)"
    echo "⏳ Waiting 10 more seconds..."
    sleep 10
    echo "🔄 Retrying..."
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="roles/aiplatform.user" \
        > /dev/null
}

echo "✅ Permissions granted"

echo ""
echo "Step 3: Creating Service Account Key"
echo "====================================="

# Remove old key file if it exists
if [ -f "$KEY_FILE" ]; then
    echo "⚠️  Old key file found. Removing..."
    rm "$KEY_FILE"
fi

# Create new key
gcloud iam service-accounts keys create "$KEY_FILE" \
    --iam-account=$SERVICE_ACCOUNT_EMAIL

echo "✅ Service account key created: $KEY_FILE"

echo ""
echo "Step 4: Base64 Encoding for EAS"
echo "================================"

# Base64 encode the key (handle both macOS and Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    base64 -i "$KEY_FILE" -o "$BASE64_FILE"
else
    # Linux
    base64 -w 0 "$KEY_FILE" > "$BASE64_FILE"
fi

echo "✅ Base64-encoded key saved to: $BASE64_FILE"

echo ""
echo "Step 5: Setting EAS Secret"
echo "=========================="
echo ""
echo "Now you need to add this as an EAS secret. Run:"
echo ""
echo "  eas secret:create --scope project --name GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 --type string --value \"\$(cat $BASE64_FILE)\""
echo ""
echo "Or if you prefer to do it interactively:"
echo ""
echo "  eas secret:create --scope project --name GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 --type string"
echo ""
echo "  Then paste the contents of: $BASE64_FILE"
echo ""

# Show first/last characters of base64 for verification
BASE64_CONTENT=$(cat "$BASE64_FILE")
BASE64_LENGTH=${#BASE64_CONTENT}
BASE64_START="${BASE64_CONTENT:0:40}"
BASE64_END="${BASE64_CONTENT: -40}"

echo "📝 Base64 preview (first 40 chars): $BASE64_START..."
echo "📝 Base64 preview (last 40 chars):  ...$BASE64_END"
echo "📏 Total length: $BASE64_LENGTH characters"
echo ""

echo "✅ Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Run the EAS secret command shown above"
echo "2. Rebuild your EAS project: eas build --platform all"
echo "3. The API routes will now use the service account credentials"
echo ""
echo "🔒 IMPORTANT: Keep your service account key files secure!"
echo "   - Do NOT commit $KEY_FILE to git"
echo "   - Consider adding to .gitignore: *service-account*.json"
echo ""
