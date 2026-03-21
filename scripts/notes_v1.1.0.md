Giga Bot v1.1.0 is the first major release under the Gignaati brand. It introduces multi-LLM routing, India-first AI model support via PragatiGPT, fully local inference via Ollama, and a production-ready README with one-line cross-platform installers.

---

## What's Changed in v1.1.0

### ✨ New Features

- Added **PragatiGPT** provider — India's first Small Language Model optimised for edge and on-device deployment, with zero cloud dependency
- Added **Ollama** provider for fully local AI inference — run any open-weight model on your own hardware
- Added **Custom endpoint** provider for any OpenAI-compatible API (self-hosted, local, or third-party)
- Added `validateProviderConfig()` utility for runtime provider validation with actionable error messages
- Added `getProviderLabel()` utility for human-readable provider display names
- Full **Gignaati branding** applied across all templates, components, and documentation
- Production-grade README with feature comparison tables, LLM provider guide, and deployment walkthrough
- One-line cross-platform installers for macOS, Linux, and Windows

### 🔧 Other Changes

- Multi-LLM routing architecture: switch providers by changing `LLM_PROVIDER` and `LLM_MODEL` environment variables — no code changes needed
- Automated npm publish pipeline with Docker image builds for `amd64` and `arm64`

---

**Full Changelog**: https://github.com/gignaati/gigaclaw/compare/v1.0...v1.1.0

**npm**: `npm install gigaclaw@1.1.0` · **Upgrade**: `npx gigaclaw@latest upgrade`
