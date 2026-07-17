<div align="center">

![new-api](/web/default/public/logo.png)

# NextRouter

🍥 **An enhanced, rolling-release fork of [new-api](https://github.com/QuantumNous/new-api) — LLM gateway + browser-side agent loop**

<p align="center">
  <a href="./README.zh_CN.md">简体中文</a> |
  <a href="./README.zh_TW.md">繁體中文</a> |
  <strong>English</strong> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-AGPLv3-brightgreen" alt="license">
  </a><!--
  --><a href="https://hub.docker.com/r/webagentloop/nextrouter">
    <img src="https://img.shields.io/badge/docker-webagentloop%2Fnextrouter-blue" alt="docker">
  </a><!--
  --><a href="https://github.com/QuantumNous/new-api">
    <img src="https://img.shields.io/badge/fork%20of-QuantumNous%2Fnew--api-orange" alt="fork of QuantumNous/new-api">
  </a>
</p>

<p align="center">
  <a href="#-what-is-nextrouter">About</a> •
  <a href="#-whats-new-in-nextrouter">What's new</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-maintenance-tracking-upstream">Maintenance</a> •
  <a href="#-license">License</a>
</p>

</div>

> 🔄 **Rolling updates, tracking upstream.** NextRouter continuously merges [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api) `main`. The rolling image tag **`latest`** points to the most recent successful release (upstream + fork changes) — `docker pull` keeps you current; pin a versioned tag for reproducible deployments.

> [!IMPORTANT]
> - This project is intended solely for lawful and authorized AI API gateway, organization-level authentication, multi-model management, usage analytics, cost accounting, and private deployment scenarios.
> - Users must lawfully obtain upstream API keys, accounts, model services, and interface permissions, and must comply with upstream terms of service and applicable laws and regulations.
> - When providing generative AI services to the public, users should comply with applicable regulatory requirements and fulfill all filing, licensing, content safety, real-name verification, log retention, tax, and upstream authorization obligations required by their jurisdiction.

---

## 🧭 What is NextRouter

**NextRouter** is a community fork of [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api) that tracks upstream `main` closely. It keeps everything new-api offers — aggregation of 40+ upstream AI providers (OpenAI, Claude, Gemini, Azure, AWS Bedrock, …) behind a unified API, plus user management, billing, rate limiting, and an admin dashboard — and adds a focused set of gateway and frontend enhancements (see [What's new](#-whats-new-in-nextrouter)).

For the full feature set, model support, API formats, and configuration, refer to the **upstream documentation**: <https://docs.newapi.pro/en/docs>.

---

## 🌱 About this fork & relationship to upstream

NextRouter is **based on [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api)** (AGPLv3), which is itself based on [One API](https://github.com/songquanpeng/one-api) (MIT). This fork:

- Continuously tracks upstream `main`. The fork-specific changes are self-contained and listed below.
- Takes responsibility for its own modifications and marks them per AGPLv3 Section 7(c).
- **Preserves the required attribution notice:** `Frontend design and development by New API contributors.`
- **Preserves a visible link to the original project:** <https://github.com/QuantumNous/new-api>

See [License](#-license) and [`NOTICE`](./NOTICE) for the complete terms.

---

<!-- FORK-DELTA: NextRouter changes vs upstream QuantumNous/new-api.
     Update after merging any fork-only branch.
     Completeness check: git log --oneline --no-merges upstream/main..HEAD
     Last verified: 2026-07-16 -->

## ✨ What's new in NextRouter

> The list below highlights major differences from upstream and may not be exhaustive. See [GitHub Releases](https://github.com/WebAgentLoop/nextrouter/releases) for the complete changes in each published version; for upstream features, see the official docs.

### 🤖 Browser-side Agent loop

A new **Agent** sidebar module (`/agent`, toggle it under *Profile → Sidebar modules*) implements a complete agent conversation loop that runs entirely in the browser.

- Reuses the playground relay `/pg/chat/completions` with the OpenAI function-calling format; ships a built-in tool registry and a **calculator** tool (safe expression evaluation).
- Streams and parses tool calls; aggregates each assistant turn into a single card with a collapsible **Process** panel.
- Message actions: copy / regenerate / edit (optionally re-submit) / delete.
- Multi-session history persisted in **IndexedDB** (up to 50 sessions), with rename / switch / delete.
- An iteration cap prevents runaway tool-call loops; localized into 7 languages.

### ⚡ Channel & Relay enhancements

- **Force Stream** channel setting: for upstreams that *only* support streaming, when a client sends a non-streaming request the gateway buffers the SSE stream and returns a single non-streaming JSON response (backend buffering logic + unit tests).
- **Force Format / Force Stream** toggles are now available for **Advanced Custom** channels (previously OpenAI channel only).
- `/pg/chat/completions` is now offered as an Advanced Custom incoming-path option.

### 🧩 Model management

- **Vendor management dialog**: lists all model vendors with edit / delete / add (previously only create), including error retry.
- **Endpoint template merge**: saving now merges instead of replacing everything; invalid existing endpoint JSON is warned about before merge.

### 📊 Performance observability

- **Token-level cache hit rate**: records cached and total input tokens, calculates cache hit rates by model, group, and time bucket, and displays current and recent cache performance in model badges and performance details.

### 💰 Wallet & payments

- Fixed wallet amount display for the custom-currency (CUSTOM) mode and the Waffo Pancake payment provider.

### 📦 Releases & deployment

- The manual Docker release workflow builds and signs native amd64 / arm64 images, then promotes `latest` only after the multi-arch manifest succeeds.
- Every release creates an immutable `latest-YYYY.MM.DD.N` image tag plus a GitHub Release with categorized changes, image digest, and rollback command.

<!-- /FORK-DELTA -->

---

## 🚀 Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the fork
git clone https://github.com/WebAgentLoop/nextrouter.git
cd nextrouter

# Edit docker-compose.yml configuration
nano docker-compose.yml

# Start the service
docker-compose up -d
```

<details>
<summary><strong>Using Docker Commands</strong></summary>

```bash
# Pull the latest image
docker pull webagentloop/nextrouter:latest

# Using SQLite (default)
docker run --name nextrouter -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  webagentloop/nextrouter:latest

# Using MySQL
docker run --name nextrouter -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  webagentloop/nextrouter:latest
```

> **💡 Tip:** `-v ./data:/data` saves data in the `data` folder of the current directory; use an absolute path like `-v /your/custom/path:/data` if you prefer.

</details>

After deployment, visit `http://localhost:3000` to start using it.

### Migrating from new-api (upstream)

Already running `calciumion/new-api`? Switching to NextRouter requires **zero data migration** — the only change is the image name:

| Item                      | new-api (upstream)                   | nextrouter (fork)                | Impact                       |
| ------------------------- | ------------------------------------ | -------------------------------- | ---------------------------- |
| **Docker image**          | `calciumion/new-api:latest`          | `webagentloop/nextrouter:latest` | ✅ The *only* thing to change |
| **Data volume**           | `./data:/data` (or custom)           | `./data:/data` (or custom)       | ✅ Unchanged                  |
| **SQLite file**           | `one-api.db`                         | `one-api.db`                     | ✅ Unchanged                  |
| **Port**                  | `3000`                               | `3000`                           | ✅ Unchanged                  |
| **Environment variables** | `SQL_DSN`, `REDIS_CONN_STRING`, etc. | Same set of variables            | ✅ Unchanged                  |
| **Remote DB**             | MySQL / PostgreSQL                   | MySQL / PostgreSQL               | ✅ Unchanged, data preserved  |

```bash
# Stop the old container
docker stop new-api && docker rm new-api

# Start with the same volumes and environment
docker run --name nextrouter -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  webagentloop/nextrouter:latest
```

For Docker Compose, change `image: calciumion/new-api` to `image: webagentloop/nextrouter:latest` and run `docker compose up -d`. GORM applies any schema changes automatically on first startup — your SQLite, MySQL, or PostgreSQL data is preserved as-is.

---

## 📦 Images & Deployment

| Component | Requirement |
|------|------|
| **Image** | `webagentloop/nextrouter:latest` |
| **Local database** | SQLite (Docker must mount the `/data` directory) |
| **Remote database** | MySQL ≥ 5.7.8 or PostgreSQL ≥ 9.6 |
| **Container engine** | Docker / Docker Compose |
| **Architecture** | 64-bit only (amd64 / arm64); 32-bit is not supported |

> [!TIP]
> `latest` is a **rolling release tag** and moves only after a manually triggered multi-arch release succeeds. For reproducible deployments and rollback, pin an immutable tag such as `webagentloop/nextrouter:latest-2026.07.16.1`.

> [!WARNING]
> For multi-machine deployment, you **must** set `SESSION_SECRET` (otherwise login state is inconsistent), and a shared Redis **must** set `CRYPTO_SECRET` (otherwise data cannot be decrypted).

📖 For all environment variables and deployment methods, see the upstream [Environment Variables](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables) and [Installation](https://docs.newapi.pro/en/docs/installation) guides — they apply to this fork as well.

---

## 📚 Documentation

The upstream documentation covers the complete feature set, API reference, and configuration, and applies to NextRouter:

| Category | Link |
|------|------|
| 🚀 Deployment Guide | [Installation](https://docs.newapi.pro/en/docs/installation) |
| ⚙️ Environment Configuration | [Environment Variables](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables) |
| 📡 API Documentation | [API Reference](https://docs.newapi.pro/en/docs/api) |
| ❓ FAQ | [FAQ](https://docs.newapi.pro/en/docs/support/faq) |

---

## 🔧 Maintenance: tracking upstream

NextRouter maintains a long-lived `nextrouter` branch that continuously merges `upstream/main`. Fork-only features are developed on feature branches (e.g. `feat/frontend-agent-loop`) and merged into `nextrouter`.

When a fork-only branch merges, the [What's new](#-whats-new-in-nextrouter) section must be updated. The exact delta is always derivable from:

```bash
git log --oneline --no-merges upstream/main..HEAD
```

See `AGENTS.md` → *Fork Documentation Maintenance* for the full multi-language update checklist.

---

## 🤝 Contributing

Contributions are welcome! When opening a PR that adds or changes a fork-only feature:

1. Update the `<!-- FORK-DELTA -->` block in **all** README languages (`README.md`, `README.zh_CN.md`, `README.zh_TW.md`, `README.fr.md`, `README.ja.md`) — same structure, only the language differs.
2. Update the `Last verified` date in each block.
3. Preserve all new-api / QuantumNous attribution, the upstream link, and the AGPLv3 Section 7 notice.

---

## 📜 License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE).

Additional terms under AGPLv3 Section 7 apply (see [`NOTICE`](./NOTICE)). Modified versions **must preserve** the author attribution notice `Frontend design and development by New API contributors.` in the appropriate legal notices and in any prominent about, legal, footer, or attribution location presented by the user interface.

Modified versions that present a user interface must also preserve a visible link to the original project: <https://github.com/QuantumNous/new-api>.

This is an open-source project based on [One API](https://github.com/songquanpeng/one-api) (MIT License).

---

## 🙏 Acknowledgements

NextRouter builds on the work of the **[new-api](https://github.com/QuantumNous/new-api)** contributors and **[One API](https://github.com/songquanpeng/one-api)**. Thank you.

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=WebAgentLoop/nextrouter&type=Date)](https://star-history.com/#WebAgentLoop/nextrouter&Date)

</div>

---

<div align="center">

<sub>Built on [QuantumNous/new-api](https://github.com/QuantumNous/new-api) · Frontend design and development by New API contributors.</sub>

</div>
