#!/usr/bin/env bash
# =============================================================================
#  Giga Bot — One-Command Installer for Linux / macOS
#  Powered by Gignaati — https://www.gignaati.com
#  Usage: curl -fsSL https://raw.githubusercontent.com/gignaati/gigabot/main/install.sh | bash
# =============================================================================
set -e

# ─── TTY Re-attachment ────────────────────────────────────────────────────────
# When this script is piped via `curl | bash`, bash's stdin is the pipe (not
# the terminal). Any interactive child process (the setup wizard → @clack/prompts)
# inherits that pipe as stdin, gets EOF immediately, and exits silently.
#
# Fix: if stdin is NOT a TTY but /dev/tty is available, redirect stdin from
# /dev/tty so all interactive prompts work correctly.
# This is the same pattern used by Homebrew, Rustup, and nvm installers.
if [ ! -t 0 ] && [ -e /dev/tty ]; then
  exec < /dev/tty
fi

# ─── PATH augmentation for macOS / nvm / asdf ────────────────────────────────
# When running via `curl | bash`, the shell is non-interactive and non-login,
# so ~/.bashrc, ~/.zshrc, and /etc/profile are NOT sourced. This means:
#   - Homebrew node (/opt/homebrew/bin on Apple Silicon, /usr/local/bin on Intel)
#   - nvm-managed node (~/.nvm/versions/node/.../bin)
#   - asdf-managed node (~/.asdf/shims)
# may all be missing from PATH. We add them explicitly here.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
fi
if [ -s "$HOME/.asdf/asdf.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.asdf/asdf.sh"
fi

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║         Giga Bot — Powered by Gignaati                  ║${RESET}"
echo -e "${BOLD}${CYAN}║         https://www.gignaati.com                        ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""

# ─── Node.js check ───────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js is not installed.${RESET}"
  echo ""
  echo "  Install it from https://nodejs.org (version 18 or higher required)"
  echo ""
  echo "  Quick install options:"
  echo "    macOS (Homebrew):  brew install node"
  echo "    Linux (nvm):       curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
  echo "    Windows:           https://nodejs.org/en/download"
  exit 1
fi
NODE_VERSION=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}✗ Node.js version $NODE_VERSION is too old. Version 18+ is required.${RESET}"
  echo "  Current: $(node --version)"
  echo "  Please upgrade: https://nodejs.org"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${RESET}"

# ─── npm check ───────────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  echo -e "${RED}✗ npm is not installed.${RESET}"
  echo "  npm comes bundled with Node.js. Please reinstall from https://nodejs.org"
  exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${RESET}"

# ─── Git check (optional — only needed for Cloud Mode) ───────────────────────
if ! command -v git &>/dev/null; then
  echo -e "${YELLOW}⚠ Git is not installed (optional — only needed for Cloud Mode).${RESET}"
fi

# ─── Docker check (optional — only needed for running via docker-compose) ────
if ! command -v docker &>/dev/null; then
  echo -e "${YELLOW}⚠ Docker is not installed (optional — needed to run via docker-compose).${RESET}"
  echo -e "  Install from https://docs.docker.com/get-docker/"
fi

# ─── Project directory ───────────────────────────────────────────────────────
# Supports GIGABOT_DIR env var for non-interactive / CI usage
PROJECT_DIR="${GIGABOT_DIR:-${1:-my-gigabot}}"

# Resolve the absolute path so we can cd back to it after subshells
ABS_PROJECT_DIR="$(pwd)/${PROJECT_DIR}"

echo ""
echo -e "${BOLD}Creating project in: ${PROJECT_DIR}/${RESET}"
mkdir -p "$PROJECT_DIR"

# ─── Scaffold the project ────────────────────────────────────────────────────
# --yes suppresses the "Ok to proceed? (y)" npm prompt that hangs curl|bash.
# Install from GitHub to always get the latest code (bypasses stale npm registry).
echo ""
echo -e "${BOLD}Scaffolding Giga Bot project...${RESET}"
(cd "$PROJECT_DIR" && npx --yes github:gignaati/gigabot init)

echo ""
echo -e "${GREEN}${BOLD}✅ Giga Bot scaffolded successfully!${RESET}"
echo ""

# ─── Install npm dependencies ────────────────────────────────────────────────
# The scaffolded project needs its deps installed before npm run setup can run.
echo -e "${BOLD}Installing dependencies...${RESET}"
(cd "$ABS_PROJECT_DIR" && npm install)
echo ""

# ─── Auto-launch setup wizard ────────────────────────────────────────────────
# Change into the project directory and run setup immediately so the user
# does not have to manually cd and run a second command.
# Set GIGABOT_SKIP_SETUP=1 to bypass the wizard (useful in CI/CD pipelines
# or automated provisioning where interactive prompts are not desired).
cd "$ABS_PROJECT_DIR"
if [ "${GIGABOT_SKIP_SETUP:-0}" = "1" ]; then
  echo -e "${BOLD}${YELLOW}⚡ Skipping setup wizard (GIGABOT_SKIP_SETUP=1)${RESET}"
  echo -e "   Run ${CYAN}npm run setup${RESET} manually to configure GigaBot."
else
  echo -e "${BOLD}Launching setup wizard...${RESET}"
  echo ""
  npm run setup
fi

# ─── Post-setup instructions ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}✅ Setup complete!${RESET}"
echo ""
echo -e "${BOLD}To start GigaBot:${RESET}"
echo -e "  ${CYAN}cd ${PROJECT_DIR} && npm run dev${RESET}   — Next.js dev server"
echo -e "  ${CYAN}docker compose -f docker-compose.local.yml up -d${RESET}   — Docker (Local Mode)"
echo ""
echo -e "${BOLD}Docs:${RESET}    https://github.com/gignaati/gigabot"
echo -e "${BOLD}Support:${RESET} support@gignaati.com"
echo -e "${BOLD}Website:${RESET} https://gigabot.gignaati.com"
echo ""
