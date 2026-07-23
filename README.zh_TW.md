<div align="center">

![new-api](/web/public/logo.png)

# NextRouter

🍥 **基於 [new-api](https://github.com/QuantumNous/new-api) 的智慧 LLM 閘道 — 統一 API、閘道知識 Agent 與多語言模型內容**

<p align="center">
  <a href="./README.zh_CN.md">简体中文</a> |
  <strong>繁體中文</strong> |
  <a href="./README.md">English</a> |
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
  <a href="#-nextrouter-是什麼">關於</a> •
  <a href="#-nextrouter-相比上游的改進">改進</a> •
  <a href="#-快速開始">快速開始</a> •
  <a href="#-維護如何追蹤上游">維護</a> •
  <a href="#-授權條款">授權</a>
</p>

</div>

> 🔄 **滾動更新，緊隨上游。** NextRouter 持續合併 [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api) 的 `main` 分支。滾動映像 tag **`latest`** 指向最近一次成功發布（上游 + fork 改動）——`docker pull` 即可保持最新；固定版本 tag 可實現可重現部署。

> [!IMPORTANT]
> - 本專案僅面向合法授權的 AI API 閘道、組織內部鑑權、多模型管理、用量統計、成本核算和私有化部署場景。
> - 使用者必須合法取得上游 API Key、帳號、模型服務或介面權限，並遵守上游服務條款及適用法律法規。
> - 面向公眾提供生成式人工智慧服務時，使用者應遵守適用監管要求，並自行完成所在司法轄區要求的備案、許可、內容安全、實名核驗、日誌留存、稅務和上游授權等合規義務。

---

## 🧭 NextRouter 是什麼

**NextRouter** 是一個智慧 LLM 閘道，也是 [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api) 的社群 Fork，持續追蹤上游 `main`。它保留了 new-api 的全部能力——在統一 API 後聚合 40+ 上游 AI 提供商（OpenAI、Claude、Gemini、Azure、AWS Bedrock 等），並配套使用者管理、計費、限流與管理後台——同時將閘道知識接入模型輔助工作流程。瀏覽器端 Agent 可以查詢閘道實際提供的模型與管理員維護的文件，回答有關模型、端點和接入方式的問題；管理員也可以呼叫 LLM 翻譯動態的模型描述與文件，並將譯文持久化（見[相比上游的改進](#-nextrouter-相比上游的改進)）。

完整功能、模型支援、API 格式與設定，請參閱**上游官方文件**：<https://docs.newapi.pro>。

---

## 🌱 關於本 Fork 與上游的關係

NextRouter **基於 [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api)**（AGPLv3），後者又基於 [One API](https://github.com/songquanpeng/one-api)（MIT）。本 Fork：

- 持續追蹤上游 `main`；目前已同步至上游提交 `e0d51561`。Fork 獨有的改動自成一套，列於下方。
- 對自身修改負責，並依 AGPLv3 第 7(c) 條標註修改。
- **保留必要的署名聲明：** `Frontend design and development by New API contributors.`
- **保留指向原始專案的可見連結：** <https://github.com/QuantumNous/new-api>

完整條款見[授權條款](#-授權條款)與 [`NOTICE`](./NOTICE)。

---

<!-- FORK-DELTA: NextRouter changes vs upstream QuantumNous/new-api.
     Update after merging any fork-only branch.
     Completeness check: git log --oneline --no-merges upstream/main..HEAD
     Last verified: 2026-07-23 -->

## ✨ NextRouter 相比上游的改進

> 下方列出與上游的主要差異，但可能並不詳盡。每個已發布版本的完整變更請參見 [GitHub Releases](https://github.com/WebAgentLoop/nextrouter/releases)；上游既有功能請見官方文件。

### 🤖 閘道知識 Agent

新增 **Agent** 側邊欄模組（`/agent`，在「個人資料 → 側邊欄模組」開關），實作完全在瀏覽器端執行的 Agent 對話迴圈。

- 複用 playground relay `/pg/chat/completions`，採用 OpenAI function-calling 格式；內建工具登錄表與**計算機**工具（安全運算式求值）。
- **閘道知識工具包**：列出閘道目前實際提供的模型，並讀取管理員維護的 Markdown 文件，讓 Agent 能回答與本平台模型、端點和接入方式相關的問題。
- **可擴充工具包**：管理員可以啟用內建閘道知識和可選的 Exa MCP 網路搜尋，並設定 Agent 的預設模型、分組與系統指令。
- 串流解析 tool-call；將每個 AI 回合聚合成一張卡片，附可摺疊的 **Process** 過程面板。
- 訊息操作：複製 / 重新生成 / 編輯（可選擇是否重新提交） / 刪除。
- 多會話歷史持久化於 **IndexedDB**（最多 50 個會話），支援重新命名 / 切換 / 刪除。
- 迭代次數上限保護，防止工具呼叫死迴圈；7 語言在地化。

### ⚡ 通道與 Relay 增強

- **Force Stream** 通道設定：針對「只支援串流」的上游，當客戶端發非串流請求時，閘道緩衝 SSE 串流並回傳單一非串流 JSON 回應（含後端緩衝邏輯與單元測試）。
- **Force Format / Force Stream** 開關對**進階自訂（Advanced Custom）**通道開放（此前僅 OpenAI 通道）。
- `/pg/chat/completions` 作為進階自訂入站路徑選項。

### 🧩 模型管理

- **廠商（Vendor）管理對話框**：列出全部模型廠商，支援編輯 / 刪除 / 新增（此前僅能建立），含錯誤重試。
- **端點範本合併**：儲存時改為合併而非整體覆蓋；既有端點 JSON 非法時於合併前告警。
- **可設定的模型廣場可見性**：管理員可要求模型必須具備已啟用的模型設定（精確比對或名稱規則比對）才能顯示於目錄中，且不影響通道路由。
- **Markdown 模型文件**：管理員可以維護各模型的專屬指南，文件會顯示於模型目錄中，並可供閘道知識 Agent 查詢。
- **模型內容持久化翻譯**：管理員手動觸發 LLM 翻譯模型描述與文件；依語言持久化譯文、來源內容雜湊、狀態與錯誤，並支援設定來源語言/預設語言及過期內容偵測。

### 📊 效能可觀測性

- **Token 級快取命中率**：記錄快取命中的輸入 Token 與總輸入 Token，依模型、分組和時間區段計算快取命中率，並在模型效能徽章與效能詳情中顯示目前及近期快取表現。

### 💰 錢包與支付

- 修正自訂貨幣（CUSTOM）模式與 Waffo Pancake 支付方式的錢包金額顯示。

### 📦 發布與部署

- 手動 Docker 發布工作流程原生建構並簽署 amd64 / arm64 映像，僅在多架構 manifest 成功後才更新 `latest`。
- 每次發布都會建立不可變的 `latest-YYYY.MM.DD.N` 映像 tag，以及包含分類變更、映像 digest 和回滾指令的 GitHub Release。

<!-- /FORK-DELTA -->

---

## 🚀 快速開始

### 使用 Docker Compose（推薦）

```bash
# 複製本 Fork
git clone https://github.com/WebAgentLoop/nextrouter.git
cd nextrouter

# 編輯 docker-compose.yml 設定
nano docker-compose.yml

# 啟動服務
docker-compose up -d
```

<details>
<summary><strong>使用 Docker 指令</strong></summary>

```bash
# 拉取最新映像
docker pull webagentloop/nextrouter:latest

# 使用 SQLite（預設）
docker run --name nextrouter -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  webagentloop/nextrouter:latest

# 使用 MySQL
docker run --name nextrouter -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  webagentloop/nextrouter:latest
```

> **💡 提示：** `-v ./data:/data` 會將資料保存在目前目錄的 `data` 資料夾；也可使用絕對路徑，如 `-v /your/custom/path:/data`。

</details>

部署完成後，造訪 `http://localhost:3000` 即可開始使用。

### 從 new-api（上游）遷移

正在使用 `calciumion/new-api`？切換到 NextRouter **無需資料遷移**——只需變更映像名稱：

| 項目            | new-api（上游）                   | nextrouter（本 Fork）            | 影響                 |
| --------------- | --------------------------------- | -------------------------------- | -------------------- |
| **Docker 映像** | `calciumion/new-api:latest`       | `webagentloop/nextrouter:latest` | ✅ 唯一需要改動的地方 |
| **資料卷**      | `./data:/data`（或自訂）          | `./data:/data`（或自訂）         | ✅ 不變               |
| **SQLite 檔案** | `one-api.db`                      | `one-api.db`                     | ✅ 不變               |
| **連接埠**      | `3000`                            | `3000`                           | ✅ 不變               |
| **環境變數**    | `SQL_DSN`、`REDIS_CONN_STRING` 等 | 同一套變數                       | ✅ 不變               |
| **遠端資料庫**  | MySQL / PostgreSQL                | MySQL / PostgreSQL               | ✅ 不變，資料保留     |

```bash
# 停掉舊容器
docker stop new-api && docker rm new-api

# 使用相同的磁碟區和環境啟動
docker run --name nextrouter -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  webagentloop/nextrouter:latest
```

使用 Docker Compose 的使用者只需將 `image: calciumion/new-api` 改為 `image: webagentloop/nextrouter:latest`，然後執行 `docker compose up -d`。GORM 在首次啟動時會自動套用任何 schema 變更——您的 SQLite、MySQL 或 PostgreSQL 資料將被完整保留。

---

## 📦 映像與部署

| 元件 | 要求 |
|------|------|
| **映像** | `webagentloop/nextrouter:latest` |
| **本地資料庫** | SQLite（Docker 必須掛載 `/data` 目錄） |
| **遠端資料庫** | MySQL ≥ 5.7.8 或 PostgreSQL ≥ 9.6 |
| **容器引擎** | Docker / Docker Compose |
| **系統架構** | 僅 64 位元（amd64 / arm64），不支援 32 位元 |

> [!TIP]
> `latest` 是**滾動發布 tag**，僅在手動觸發的多架構發布成功後才會移動。如需可重現部署和回滾，請固定到不可變 tag，例如 `webagentloop/nextrouter:latest-2026.07.16.1`。

> [!WARNING]
> 多機部署時**必須**設定 `SESSION_SECRET`（否則登入狀態不一致）；共享 Redis **必須**設定 `CRYPTO_SECRET`（否則資料無法解密）。

📖 所有環境變數與部署方式，請見上游[環境變數](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables)與[安裝](https://docs.newapi.pro/en/docs/installation)文件——它們同樣適用於本 Fork。

---

## 📚 文件

上游文件涵蓋了完整功能、API 參考與設定，並適用於 NextRouter：

| 分類 | 連結 |
|------|------|
| 🚀 部署指南 | [安裝文件](https://docs.newapi.pro/en/docs/installation) |
| ⚙️ 環境設定 | [環境變數](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables) |
| 📡 API 文件 | [API 參考](https://docs.newapi.pro/en/docs/api) |
| ❓ 常見問題 | [FAQ](https://docs.newapi.pro/en/docs/support/faq) |

---

## 🔧 維護：如何追蹤上游

NextRouter 維護長期分支 `nextrouter`，持續合併 `upstream/main`。Fork 獨有功能在 feature 分支（如 `feat/frontend-agent-loop`）開發後合併進 `nextrouter`。

當合併 fork-only 分支時，必須更新[相比上游的改進](#-nextrouter-相比上游的改進)章節。確切差異始終可由以下指令推導：

```bash
git log --oneline --no-merges upstream/main..HEAD
```

完整的多語言更新清單見 `AGENTS.md` → *Fork Documentation Maintenance*。

---

## 🤝 貢獻

歡迎貢獻！提交涉及 fork-only 功能的 PR 時：

1. 更新**全部**語言 README（`README.md`、`README.zh_CN.md`、`README.zh_TW.md`、`README.fr.md`、`README.ja.md`）中的 `<!-- FORK-DELTA -->` 區塊——結構一致，僅語言不同。
2. 更新每個區塊頭部的 `Last verified` 日期。
3. 保留所有 new-api / QuantumNous 署名、上游連結與 AGPLv3 Section 7 聲明。

---

## 📜 授權條款

本專案基於 [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE) 授權。

AGPLv3 Section 7 的附加條款適用（見 [`NOTICE`](./NOTICE)）。修改版本**必須保留**署名聲明 `Frontend design and development by New API contributors.`，置於相應的法律聲明及使用者介面中任何顯眼的關於、法律、頁尾或署名位置。

提供使用者介面的修改版本還必須保留指向原始專案的可見連結：<https://github.com/QuantumNous/new-api>。

本專案是基於 [One API](https://github.com/songquanpeng/one-api)（MIT License）的開源專案。

---

## 🙏 致謝

NextRouter 建構於 **[new-api](https://github.com/QuantumNous/new-api)** 貢獻者與 **[One API](https://github.com/songquanpeng/one-api)** 的工作之上，在此致謝。

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=WebAgentLoop/nextrouter&type=Date)](https://star-history.com/#WebAgentLoop/nextrouter&Date)

</div>

---

<div align="center">

<sub>建構於 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 之上 · Frontend design and development by New API contributors.</sub>

</div>
