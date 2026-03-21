#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: local.sh <path-to-project>"
  exit 1
fi

PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$(cd "$1" && pwd)"
DEST="$TARGET_DIR/node_modules/gigaclaw"

if [ ! -d "$DEST" ]; then
  echo "Error: gigaclaw not found in $TARGET_DIR/node_modules/"
  exit 1
fi

# 1. Sync templates → project root
#    - exclude *.template files (handled separately below with rename)
#    - exclude bare CLAUDE.md (matches init's EXCLUDED_FILENAMES)
echo "Syncing templates to project..."
rsync -av "$PACKAGE_DIR/templates/" "$TARGET_DIR/" \
  --exclude '*.template' \
  --exclude 'CLAUDE.md'

# Handle .template files (strip suffix on copy)
cp "$PACKAGE_DIR/templates/.gitignore.template" "$TARGET_DIR/.gitignore"
cp "$PACKAGE_DIR/templates/CLAUDE.md.template" "$TARGET_DIR/CLAUDE.md"

# 2. Sync package runtime → node_modules/gigaclaw
echo "Syncing package to node_modules..."
rsync -av --delete "$PACKAGE_DIR/lib/" "$DEST/lib/"
rsync -av --delete "$PACKAGE_DIR/api/" "$DEST/api/"
rsync -av --delete "$PACKAGE_DIR/config/" "$DEST/config/"
rsync -av --delete "$PACKAGE_DIR/bin/" "$DEST/bin/"
rsync -av --delete "$PACKAGE_DIR/setup/" "$DEST/setup/"
rsync -av --delete "$PACKAGE_DIR/drizzle/" "$DEST/drizzle/"
rsync -av --delete "$PACKAGE_DIR/templates/" "$DEST/templates/"
cp "$PACKAGE_DIR/package.json" "$DEST/package.json"

# 3. Build JSX (esbuild is in source repo, compile all .jsx files in destination)
echo "Building JSX..."
find "$DEST/lib" -name '*.jsx' -print0 | while IFS= read -r -d '' file; do
  outdir="$(dirname "$file")"
  "$PACKAGE_DIR/node_modules/.bin/esbuild" "$file" \
    --outdir="$outdir" --format=esm --jsx=automatic
done

# 4. Install any dependencies from gigaclaw that aren't in the target yet
echo "Checking for missing dependencies..."
MISSING=$(node -e "
const fs = require('fs');
const path = require('path');
const pkg = JSON.parse(fs.readFileSync('$DEST/package.json', 'utf8'));
const missing = [];
for (const [name, ver] of Object.entries(pkg.dependencies || {})) {
  if (!fs.existsSync(path.join('$TARGET_DIR', 'node_modules', name))) missing.push(name + '@' + ver);
}
if (missing.length) console.log(missing.join(' '));
")
if [ -n "$MISSING" ]; then
  echo "Installing missing dependencies: $MISSING"
  cd "$TARGET_DIR" && npm install $MISSING
else
  echo "All dependencies present."
fi

# 5. Clear .next cache and rebuild
echo "Clearing .next cache..."
rm -rf "$TARGET_DIR/.next"

echo "Rebuilding..."
cd "$TARGET_DIR" && npm run build

# 6. Restart the server
if [ -f "$TARGET_DIR/docker-compose.yml" ] && docker compose version &>/dev/null; then
  echo "Restarting Docker container..."
  cd "$TARGET_DIR" && docker compose restart event-handler
elif pgrep -f "next-server.*$TARGET_DIR" &>/dev/null; then
  echo "Restarting Next.js server..."
  pkill -f "next-server.*$TARGET_DIR"
  cd "$TARGET_DIR" && npm start &
fi

echo "Done!"
