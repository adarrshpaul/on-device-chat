#!/bin/bash
# ============================================================
# on-device-chat — One-shot build + publish script
# Usage: ./scripts/publish.sh [patch|minor|major|0.x.y]
# ============================================================
set -e

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$FRONTEND_DIR"

BUMP="${1:-patch}"

echo ""
echo "🔐 Checking npm auth..."
if ! npm whoami &>/dev/null; then
  echo "❌ Not logged in to npm. Run: npm login"
  exit 1
fi
echo "✅ Logged in as: $(npm whoami)"

echo ""
echo "📦 Current version: $(node -p "require('./package.json').version")"

# Bump version
if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  npm version "$BUMP" --no-git-tag-version
else
  npm version "$BUMP" --no-git-tag-version
fi

NEW_VERSION=$(node -p "require('./package.json').version")
echo "🚀 New version: $NEW_VERSION"

echo ""
echo "🔨 Building..."
npm run build

echo ""
echo "🧪 Running giskard tests..."
npm run test:giskard

echo ""
echo "📤 Publishing on-device-chat@$NEW_VERSION to npm..."
npm publish --access public

echo ""
echo "✅ Published! Verifying on registry..."
sleep 3
npm view on-device-chat@"$NEW_VERSION" version

echo ""
echo "🔗 CDN links (live in ~60s):"
echo "   jsDelivr: https://cdn.jsdelivr.net/npm/on-device-chat@$NEW_VERSION/dist/edge-operator.min.js"
echo "   unpkg:    https://unpkg.com/on-device-chat@$NEW_VERSION/dist/edge-operator.min.js"

# Save token to keychain for next time
TOKEN=$(grep "_authToken" ~/.npmrc 2>/dev/null | cut -d= -f2 | head -1)
if [ -n "$TOKEN" ]; then
  security add-generic-password -a "$USER" -s "NPM_TOKEN" -w "$TOKEN" -U 2>/dev/null && \
    echo "🔑 Token saved to macOS Keychain as NPM_TOKEN" || true
fi

echo ""
echo "🎉 Done! on-device-chat@$NEW_VERSION is live."
