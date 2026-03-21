#!/usr/bin/env bash
# =============================================================================
#  Gigaclaw — One-Command Installer for Linux / macOS
#  Powered by Gignaati — https://gigaclaw.gignaati.com
#
#  Usage:
#    curl -fsSL https://raw.githubusercontent.com/gignaati/gigaclaw/main/install.sh | bash
#    curl -fsSL ... | bash -s -- my-project-name
#    GIGACLAW_DIR=my-dir curl -fsSL ... | bash
#    GIGACLAW_SKIP_SETUP=1 curl -fsSL ... | bash   (CI/CD — skips interactive wizard)
#
#  What this script does:
#    1. Checks prerequisites (Node.js ≥18, npm, Git, Ollama, Docker, ngrok)
#       — shows friendly messages and exact install commands for anything missing
#       — offers retry loops so you can install in another terminal and continue
#    2. Scaffolds a new Gigaclaw project via npx gigaclaw@latest init
#    3. Installs npm dependencies
#    4. Launches the interactive setup wizard (npm run setup)
# =============================================================================
set -euo pipefail

# ─── TTY Re-attachment ────────────────────────────────────────────────────────
# When piped via `curl | bash`, stdin is the pipe. Re-attach to /dev/tty so
# interactive prompts (setup wizard, retry loops) work correctly.
if [ ! -t 0 ] && [ -e /dev/tty ]; then
  exec < /dev/tty
fi

# ─── PATH augmentation ───────────────────────────────────────────────────────
# Non-interactive shells don't source ~/.bashrc / ~/.zshrc, so package manager
# paths are missing. Add the most common locations explicitly.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ]  && . "$HOME/.nvm/nvm.sh"
[ -s "$HOME/.asdf/asdf.sh" ] && . "$HOME/.asdf/asdf.sh"
command -v fnm &>/dev/null  && eval "$(fnm env --use-on-cd 2>/dev/null)" || true
[ -d "$HOME/.volta/bin" ]   && export PATH="$HOME/.volta/bin:$PATH"

# ─── Colours ─────────────────────────────────────────────────────────────────
BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
DIM="\033[2m"
RESET="\033[0m"

ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
fail() { echo -e "  ${RED}✗${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
info() { echo -e "  ${CYAN}→${RESET}  $*"; }
step() { echo -e "\n${BOLD}$*${RESET}"; }

# ─── OS detection ────────────────────────────────────────────────────────────
case "$(uname -s)" in
  Darwin) OS="macos" ;;
  Linux)  OS="linux" ;;
  *)      OS="unknown" ;;
esac

# ─── Retry helper ────────────────────────────────────────────────────────────
press_enter_to_retry() {
  echo ""
  echo -e "  ${DIM}Press ${BOLD}Enter${RESET}${DIM} once you have installed it to retry, or ${BOLD}Ctrl+C${RESET}${DIM} to abort.${RESET}"
  read -r _
  # Re-source PATH augmentations in case user just installed via nvm/homebrew
  export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
  [ -s "$HOME/.nvm/nvm.sh" ]  && . "$HOME/.nvm/nvm.sh"
  [ -s "$HOME/.asdf/asdf.sh" ] && . "$HOME/.asdf/asdf.sh"
  command -v fnm &>/dev/null  && eval "$(fnm env --use-on-cd 2>/dev/null)" || true
  [ -d "$HOME/.volta/bin" ]   && export PATH="$HOME/.volta/bin:$PATH"
}

# =============================================================================
# BANNER
# =============================================================================
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║  Gigaclaw — Autonomous AI Agent  ·  Powered by Gignaati  ║${RESET}"
echo -e "${BOLD}${CYAN}║  https://gigaclaw.gignaati.com                           ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""

# =============================================================================
# STEP 1 — PREREQUISITE CHECKS
# =============================================================================
step "[ 1 / 6 ]  Checking prerequisites..."
echo ""

PREREQ_FAILED=0

# ── Node.js ──────────────────────────────────────────────────────────────────
check_node() {
  while ! command -v node &>/dev/null; do
    fail "Node.js is not installed."
    echo ""
    echo -e "  Gigaclaw requires ${BOLD}Node.js 18 or higher${RESET}."
    echo ""
    echo -e "  ${BOLD}Install options:${RESET}"
    if [ "$OS" = "macos" ]; then
      echo -e "    ${CYAN}brew install node${RESET}                             — Homebrew (recommended)"
      echo -e "    ${CYAN}curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash${RESET}"
      echo -e "    ${CYAN}nvm install 18${RESET}                                — after nvm is installed"
    elif [ "$OS" = "linux" ]; then
      echo -e "    ${CYAN}curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash${RESET}"
      echo -e "    ${CYAN}nvm install 18${RESET}                                — after nvm is installed"
      echo -e "    ${CYAN}sudo apt-get install -y nodejs${RESET}                — Debian/Ubuntu (v18+ repo)"
      echo -e "    ${CYAN}sudo dnf install nodejs${RESET}                       — Fedora/RHEL"
    fi
    echo -e "    ${CYAN}https://nodejs.org/en/download${RESET}                — Official installer"
    echo ""
    press_enter_to_retry
  done

  local node_major
  node_major=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  while [ "$node_major" -lt 18 ]; do
    fail "Node.js $(node --version) is too old. Version 18+ is required."
    echo ""
    echo -e "  ${BOLD}Upgrade options:${RESET}"
    if [ "$OS" = "macos" ]; then
      echo -e "    ${CYAN}brew upgrade node${RESET}"
      echo -e "    ${CYAN}nvm install 18 && nvm use 18${RESET}"
    else
      echo -e "    ${CYAN}nvm install 18 && nvm use 18${RESET}                  — if using nvm"
      echo -e "    ${CYAN}fnm install 18 && fnm use 18${RESET}                  — if using fnm"
      echo -e "    ${CYAN}https://nodejs.org/en/download${RESET}                — Official installer"
    fi
    echo ""
    press_enter_to_retry
    node_major=$(node -e "process.stdout.write(process.versions.node.split('.')[0])" 2>/dev/null || echo "0")
  done
  ok "Node.js $(node --version)"
}
check_node

# ── npm ──────────────────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  fail "npm is not found."
  echo ""
  echo -e "  npm ships bundled with Node.js. Please reinstall Node.js:"
  echo -e "    ${CYAN}https://nodejs.org/en/download${RESET}"
  echo ""
  press_enter_to_retry
  if ! command -v npm &>/dev/null; then
    fail "npm still not found. Please reinstall Node.js and re-run this script."
    PREREQ_FAILED=1
  else
    ok "npm $(npm --version)"
  fi
else
  ok "npm $(npm --version)"
fi

# ── Git ───────────────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  warn "Git is not installed."
  echo ""
  echo -e "  Git is ${BOLD}required for Cloud Mode${RESET} (GitHub Actions integration)."
  echo -e "  You can skip it now if you only plan to use ${BOLD}Local Mode${RESET} (Ollama only)."
  echo ""
  echo -e "  ${BOLD}Install options:${RESET}"
  if [ "$OS" = "macos" ]; then
    echo -e "    ${CYAN}brew install git${RESET}"
    echo -e "    ${CYAN}xcode-select --install${RESET}                        — Xcode Command Line Tools"
  elif [ "$OS" = "linux" ]; then
    echo -e "    ${CYAN}sudo apt-get install git${RESET}                       — Debian/Ubuntu"
    echo -e "    ${CYAN}sudo dnf install git${RESET}                           — Fedora/RHEL"
    echo -e "    ${CYAN}sudo pacman -S git${RESET}                             — Arch Linux"
  fi
  echo -e "    ${CYAN}https://git-scm.com/downloads${RESET}                 — Official installer"
  echo ""
  echo -e "  ${DIM}Press Enter to continue without Git (Local Mode only), or install Git first and press Enter to retry.${RESET}"
  read -r _
  if command -v git &>/dev/null; then
    ok "git $(git --version | sed 's/git version //')"
  else
    warn "Continuing without Git. Cloud Mode will not be available."
  fi
else
  ok "git $(git --version | sed 's/git version //')"
fi

# ── Ollama ───────────────────────────────────────────────────────────────────
check_ollama() {
  if ! command -v ollama &>/dev/null; then
    warn "Ollama is not installed."
    echo ""
    echo -e "  Ollama is ${BOLD}required for Local Mode${RESET} (100% private, on-device AI inference)."
    echo -e "  You can skip it if you plan to use a cloud LLM provider (OpenAI, Claude, Gemini)."
    echo ""
    echo -e "  ${BOLD}Install Ollama:${RESET}"
    if [ "$OS" = "macos" ]; then
      echo -e "    ${CYAN}brew install ollama${RESET}                           — Homebrew"
      echo -e "    ${CYAN}https://ollama.com/download${RESET}                   — Official macOS app"
    elif [ "$OS" = "linux" ]; then
      echo -e "    ${CYAN}curl -fsSL https://ollama.com/install.sh | sh${RESET} — Official installer"
    fi
    echo ""
    echo -e "  ${BOLD}Then start Ollama and pull a model:${RESET}"
    echo -e "    ${CYAN}ollama serve${RESET}                                  — start the Ollama server"
    echo -e "    ${CYAN}ollama pull llama3${RESET}                            — Llama 3 (recommended)"
    echo -e "    ${CYAN}ollama pull qwen2.5:3b${RESET}                        — lightweight (low-RAM devices)"
    echo -e "    ${CYAN}ollama pull mistral${RESET}                           — Mistral 7B"
    echo ""
    echo -e "  ${DIM}Press Enter to continue without Ollama (cloud LLM only), or install and start Ollama first and press Enter to retry.${RESET}"
    read -r _
    if command -v ollama &>/dev/null && curl -sf http://localhost:11434/api/tags &>/dev/null; then
      ok "Ollama is installed and running at localhost:11434"
    elif command -v ollama &>/dev/null; then
      warn "Ollama installed but not running. The setup wizard will check again."
      info "Start it with: ${CYAN}ollama serve${RESET}"
    else
      warn "Continuing without Ollama. You can install it later and run: ${CYAN}ollama serve${RESET}"
    fi
    return
  fi

  # Ollama binary found — check if server is reachable
  if curl -sf http://localhost:11434/api/tags &>/dev/null; then
    ok "Ollama is running at localhost:11434"
    return
  fi

  warn "Ollama is installed but not running."
  echo ""
  echo -e "  ${BOLD}Start Ollama in a new terminal:${RESET}"
  echo -e "    ${CYAN}ollama serve${RESET}"
  echo ""

  local retries=0
  while [ $retries -lt 3 ]; do
    echo -e "  ${DIM}Press Enter once Ollama is running to retry (attempt $((retries+1))/3), or type 'skip' and Enter to continue:${RESET}"
    read -r user_input
    if [ "$user_input" = "skip" ]; then
      warn "Continuing without Ollama running. The setup wizard will prompt you again."
      return
    fi
    if curl -sf http://localhost:11434/api/tags &>/dev/null; then
      ok "Ollama is now running at localhost:11434"
      return
    fi
    retries=$((retries+1))
    warn "Ollama still not reachable on localhost:11434."
  done
  warn "Ollama not detected after 3 attempts. Continuing — start it later with: ${CYAN}ollama serve${RESET}"
}
check_ollama

# ── Docker (optional) ────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  warn "Docker is not installed (optional — needed for docker-compose deployment)."
  echo ""
  echo -e "  Docker is only required if you want to run Gigaclaw via ${BOLD}docker-compose${RESET}."
  echo -e "  The ${CYAN}npm run dev${RESET} workflow does not need Docker."
  echo ""
  echo -e "  ${BOLD}Install Docker:${RESET}"
  if [ "$OS" = "macos" ]; then
    echo -e "    ${CYAN}brew install --cask docker${RESET}                    — Docker Desktop for macOS"
    echo -e "    ${CYAN}https://docs.docker.com/desktop/mac/${RESET}"
  elif [ "$OS" = "linux" ]; then
    echo -e "    ${CYAN}curl -fsSL https://get.docker.com | sh${RESET}        — Official convenience script"
    echo -e "    ${CYAN}sudo usermod -aG docker \$USER${RESET}                — run without sudo"
    echo -e "    ${CYAN}https://docs.docker.com/engine/install/${RESET}"
  fi
  echo ""
else
  ok "Docker $(docker --version | sed 's/Docker version //' | cut -d',' -f1)"
fi

# ── ngrok (optional — Cloud Mode only) ───────────────────────────────────────
if ! command -v ngrok &>/dev/null; then
  warn "ngrok is not installed (optional — needed for Cloud Mode webhook tunnelling)."
  echo ""
  echo -e "  ngrok is only required if you choose ${BOLD}Cloud Mode${RESET} with Telegram or GitHub webhooks."
  echo -e "  Local Mode does not need ngrok."
  echo ""
  echo -e "  ${BOLD}Install ngrok:${RESET}"
  if [ "$OS" = "macos" ]; then
    echo -e "    ${CYAN}brew install ngrok/ngrok/ngrok${RESET}"
  elif [ "$OS" = "linux" ]; then
    echo -e "    ${CYAN}curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo \"deb https://ngrok-agent.s3.amazonaws.com buster main\" | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install ngrok${RESET}"
  fi
  echo -e "    ${CYAN}https://ngrok.com/download${RESET}                    — Official installer"
  echo -e "    ${CYAN}https://dashboard.ngrok.com/signup${RESET}            — Free account required"
  echo ""
else
  ok "ngrok $(ngrok version 2>/dev/null | head -1 | sed 's/ngrok version //' || echo 'installed')"
fi

# ── Abort if critical prerequisites failed ────────────────────────────────────
if [ "$PREREQ_FAILED" = "1" ]; then
  echo ""
  fail "One or more required prerequisites could not be satisfied."
  echo -e "  Please install the missing tools and re-run:"
  echo -e "    ${CYAN}curl -fsSL https://raw.githubusercontent.com/gignaati/gigaclaw/main/install.sh | bash${RESET}"
  echo ""
  exit 1
fi

echo ""
ok "All required prerequisites satisfied."

# =============================================================================
# STEP 2 — CREATE PROJECT DIRECTORY
# =============================================================================
step "[ 2 / 6 ]  Creating project..."

PROJECT_DIR="${GIGACLAW_DIR:-${1:-my-gigaclaw}}"
ABS_PROJECT_DIR="$(pwd)/${PROJECT_DIR}"

echo ""
info "Project directory: ${BOLD}${PROJECT_DIR}/${RESET}"
mkdir -p "$PROJECT_DIR"

# =============================================================================
# STEP 3 — SCAFFOLD
# =============================================================================
step "[ 3 / 6 ]  Scaffolding Gigaclaw project..."
echo ""
# --yes suppresses the "Ok to proceed? (y)" npm prompt that hangs curl|bash.
(cd "$PROJECT_DIR" && npx --yes gigaclaw@latest init)
echo ""
ok "Gigaclaw scaffolded successfully!"

# =============================================================================
# STEP 4 — INSTALL DEPENDENCIES
# =============================================================================
step "[ 4 / 6 ]  Installing npm dependencies..."
echo ""
(cd "$ABS_PROJECT_DIR" && npm install)
echo ""
ok "Dependencies installed."

# =============================================================================
# STEP 5 — SETUP WIZARD
# =============================================================================
step "[ 5 / 6 ]  Launching setup wizard..."
echo ""
cd "$ABS_PROJECT_DIR"

if [ "${GIGACLAW_SKIP_SETUP:-0}" = "1" ]; then
  warn "Skipping setup wizard (GIGACLAW_SKIP_SETUP=1)"
  info "Run ${CYAN}npm run setup${RESET} manually to configure Gigaclaw."
else
  npm run setup
fi

# =============================================================================
# STEP 6 — DONE
# =============================================================================
step "[ 6 / 6 ]  Done!"
echo ""
echo -e "${BOLD}${GREEN}✅  Gigaclaw is ready.${RESET}"
echo ""
echo -e "  ${BOLD}Start your agent:${RESET}"
echo -e "    ${CYAN}cd ${PROJECT_DIR} && npm run dev${RESET}"
echo -e "    ${DIM}— Next.js dev server (recommended for development)${RESET}"
echo ""
echo -e "    ${CYAN}cd ${PROJECT_DIR} && docker compose -f docker-compose.local.yml up -d${RESET}"
echo -e "    ${DIM}— Docker (Local Mode, requires Ollama running)${RESET}"
echo ""
echo -e "  ${BOLD}Useful commands:${RESET}"
echo -e "    ${CYAN}ollama pull llama3${RESET}     — download Llama 3 model"
echo -e "    ${CYAN}ollama serve${RESET}           — start Ollama server"
echo -e "    ${CYAN}npm run setup${RESET}          — re-run setup wizard"
echo ""
echo -e "  ${DIM}Docs:    https://github.com/gignaati/gigaclaw${RESET}"
echo -e "  ${DIM}Support: support@gignaati.com${RESET}"
echo -e "  ${DIM}Website: https://gigaclaw.gignaati.com${RESET}"
echo ""
