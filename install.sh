#!/usr/bin/env bash
# =============================================================================
#  Giga Bot — One-Command Installer for Linux / macOS
#  Powered by Gignaati — https://www.gignaati.com
# =============================================================================
set -e

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

# Check Node.js
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js is not installed.${RESET}"
  echo "  Install it from https://nodejs.org (version 18 or higher required)"
  exit 1
fi
NODE_VERSION=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}✗ Node.js version $NODE_VERSION is too old. Version 18+ is required.${RESET}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${RESET}"

# Check npm
if ! command -v npm &>/dev/null; then
  echo -e "${RED}✗ npm is not installed.${RESET}"
  exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${RESET}"

# Check Git
if ! command -v git &>/dev/null; then
  echo -e "${YELLOW}⚠ Git is not installed. Install from https://git-scm.com${RESET}"
fi

# Check GitHub CLI
if ! command -v gh &>/dev/null; then
  echo -e "${YELLOW}⚠ GitHub CLI (gh) is not installed. Install from https://cli.github.com${RESET}"
fi

# Determine project directory
PROJECT_DIR="${1:-my-gigabot}"
echo ""
echo -e "${BOLD}Creating project in: ${PROJECT_DIR}/${RESET}"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Scaffold the project
echo ""
echo -e "${BOLD}Scaffolding Giga Bot project...${RESET}"
npx gigabot@latest init

echo ""
echo -e "${GREEN}${BOLD}✅ Giga Bot scaffolded successfully!${RESET}"
echo ""
echo -e "${BOLD}NEXT STEPS:${RESET}"
echo -e "  1. ${CYAN}cd ${PROJECT_DIR}${RESET}"
echo -e "  2. ${CYAN}npm run setup${RESET}  — run the interactive setup wizard"
echo -e "  3. ${CYAN}npm run dev${RESET}    — start the development server"
echo ""
echo -e "${BOLD}Docs:${RESET}    https://github.com/gignaati/gigabot"
echo -e "${BOLD}Support:${RESET} support@gignaati.com"
echo -e "${BOLD}Website:${RESET} https://www.gignaati.com"
echo ""
