<div align="center">

![new-api](/web/public/logo.png)

# NextRouter

🍥 **[new-api](https://github.com/QuantumNous/new-api) 的滚动发布增强版 Fork — LLM 网关 + 浏览器端 Agent 循环**

<p align="center">
  <strong>简体中文</strong> |
  <a href="./README.zh_TW.md">繁體中文</a> |
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
  <a href="#-nextrouter-是什么">关于</a> •
  <a href="#-nextrouter-相比上游的改进">改进</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-维护如何跟踪上游">维护</a> •
  <a href="#-许可证">许可证</a>
</p>

</div>

> 🔄 **滚动更新，紧随上游。** NextRouter 持续合并 [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api) 的 `main` 分支。滚动镜像 tag **`latest`** 指向最近一次成功发布（上游 + fork 改动）——`docker pull` 即可保持最新；固定版本 tag 可实现可复现部署。

> [!IMPORTANT]
> - 本项目仅面向合法授权的 AI API 网关、组织内部鉴权、多模型管理、用量统计、成本核算和私有化部署场景。
> - 使用者必须合法取得上游 API Key、账号、模型服务或接口权限，并遵守上游服务条款及适用法律法规。
> - 面向公众提供生成式人工智能服务时，使用者应遵守适用监管要求，并自行完成所在司法辖区要求的备案、许可、内容安全、实名核验、日志留存、税务和上游授权等合规义务。

---

## 🧭 NextRouter 是什么

**NextRouter** 是 [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api) 的社区 Fork，持续跟踪上游 `main`。它保留了 new-api 的全部能力——在统一 API 后聚合 40+ 上游 AI 提供商（OpenAI、Claude、Gemini、Azure、AWS Bedrock 等），并配套用户管理、计费、限流与管理后台——同时新增了一批聚焦网关与前端的增强（见[相比上游的改进](#-nextrouter-相比上游的改进)）。

完整功能、模型支持、API 格式与配置，请参阅**上游官方文档**：<https://docs.newapi.pro>。

---

## 🌱 关于本 Fork 与上游的关系

NextRouter **基于 [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api)**（AGPLv3），后者又基于 [One API](https://github.com/songquanpeng/one-api)（MIT）。本 Fork：

- 持续跟踪上游 `main`；当前已同步至上游提交 `e0d51561`。Fork 独有的改动自成一体，列于下方。
- 对自身修改负责，并按 AGPLv3 第 7(c) 条标注修改。
- **保留必需的署名声明：** `Frontend design and development by New API contributors.`
- **保留指向原始项目的可见链接：** <https://github.com/QuantumNous/new-api>

完整条款见[许可证](#-许可证)与 [`NOTICE`](./NOTICE)。

---

<!-- FORK-DELTA: NextRouter changes vs upstream QuantumNous/new-api.
     Update after merging any fork-only branch.
     Completeness check: git log --oneline --no-merges upstream/main..HEAD
     Last verified: 2026-07-21 -->

## ✨ NextRouter 相比上游的改进

> 下方列出与上游的主要差异，但可能并不详尽。每个已发布版本的完整变更请参见 [GitHub Releases](https://github.com/WebAgentLoop/nextrouter/releases)；上游既有功能请见官方文档。

### 🤖 浏览器端 Agent 循环

新增 **Agent** 侧边栏模块（`/agent`，在“个人资料 → 侧边栏模块”开关），实现完全在浏览器端运行的 Agent 对话循环。

- 复用 playground relay `/pg/chat/completions`，采用 OpenAI function-calling 格式；内置工具注册表与**计算器**工具（安全表达式求值）。
- 流式解析 tool-call；将每个 AI 回合聚合成一张卡片，带可折叠的 **Process** 过程面板。
- 消息操作：复制 / 重新生成 / 编辑（可选是否重提） / 删除。
- 多会话历史持久化于 **IndexedDB**（最多 50 个会话），支持重命名 / 切换 / 删除。
- 迭代次数上限保护，防止工具调用死循环；7 语言本地化。

### ⚡ 渠道与 Relay 增强

- **Force Stream** 渠道设置：针对“只支持流式”的上游，当客户端发非流式请求时，网关缓冲 SSE 流并返回单条非流式 JSON 响应（含后端缓冲逻辑与单元测试）。
- **Force Format / Force Stream** 开关对**高级自定义（Advanced Custom）**渠道开放（此前仅 OpenAI 渠道）。
- `/pg/chat/completions` 作为高级自定义入站路径选项。

### 🧩 模型管理

- **厂商（Vendor）管理对话框**：列出全部模型厂商，支持编辑 / 删除 / 新增（此前仅能创建），含错误重试。
- **端点模板合并**：保存时改为合并而非整体覆盖；既有端点 JSON 非法时在合并前告警。
- **可配置的模型广场可见性**：管理员可要求模型必须存在已启用的模型配置（精确匹配或名称规则匹配）才能出现在目录中，且不影响渠道路由。

### 📊 性能可观测性

- **Token 级缓存命中率**：记录缓存命中的输入 Token 与总输入 Token，按模型、分组和时间段计算缓存命中率，并在模型性能徽标与性能详情中展示当前及近期缓存表现。

### 💰 钱包与支付

- 修正自定义货币（CUSTOM）模式与 Waffo Pancake 支付方式的钱包金额展示。

### 📦 发布与部署

- 手动 Docker 发布工作流原生构建并签名 amd64 / arm64 镜像，仅在多架构 manifest 成功后才更新 `latest`。
- 每次发布都会创建不可变的 `latest-YYYY.MM.DD.N` 镜像 tag，以及包含分类变更、镜像 digest 和回滚命令的 GitHub Release。

<!-- /FORK-DELTA -->

---

## 🚀 快速开始

### 使用 Docker Compose（推荐）

```bash
# 克隆本 Fork
git clone https://github.com/WebAgentLoop/nextrouter.git
cd nextrouter

# 编辑 docker-compose.yml 配置
nano docker-compose.yml

# 启动服务
docker-compose up -d
```

<details>
<summary><strong>使用 Docker 命令</strong></summary>

```bash
# 拉取最新镜像
docker pull webagentloop/nextrouter:latest

# 使用 SQLite（默认）
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

> **💡 提示：** `-v ./data:/data` 会把数据保存在当前目录的 `data` 文件夹；也可使用绝对路径，如 `-v /your/custom/path:/data`。

</details>

部署完成后，访问 `http://localhost:3000` 即可开始使用。

### 从 new-api（上游）迁移

正在使用 `calciumion/new-api`？切换到 NextRouter **无需数据迁移**——只需更改镜像名：

| 项目            | new-api（上游）                   | nextrouter（本 Fork）            | 影响                 |
| --------------- | --------------------------------- | -------------------------------- | -------------------- |
| **Docker 镜像** | `calciumion/new-api:latest`       | `webagentloop/nextrouter:latest` | ✅ 唯一需要改动的地方 |
| **数据卷**      | `./data:/data`（或自定义）        | `./data:/data`（或自定义）       | ✅ 不变               |
| **SQLite 文件** | `one-api.db`                      | `one-api.db`                     | ✅ 不变               |
| **端口**        | `3000`                            | `3000`                           | ✅ 不变               |
| **环境变量**    | `SQL_DSN`、`REDIS_CONN_STRING` 等 | 同一套变量                       | ✅ 不变               |
| **远程数据库**  | MySQL / PostgreSQL                | MySQL / PostgreSQL               | ✅ 不变，数据保留     |

```bash
# 停掉旧容器
docker stop new-api && docker rm new-api

# 使用相同的卷和环境启动
docker run --name nextrouter -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  webagentloop/nextrouter:latest
```

使用 Docker Compose 的用户只需将 `image: calciumion/new-api` 改为 `image: webagentloop/nextrouter:latest`，然后运行 `docker compose up -d`。GORM 在首次启动时会自动应用任何 schema 变更——您的 SQLite、MySQL 或 PostgreSQL 数据将被完整保留。

---

## 📦 镜像与部署

| 组件 | 要求 |
|------|------|
| **镜像** | `webagentloop/nextrouter:latest` |
| **本地数据库** | SQLite（Docker 必须挂载 `/data` 目录） |
| **远程数据库** | MySQL ≥ 5.7.8 或 PostgreSQL ≥ 9.6 |
| **容器引擎** | Docker / Docker Compose |
| **系统架构** | 仅 64 位（amd64 / arm64），不支持 32 位 |

> [!TIP]
> `latest` 是**滚动发布 tag**，仅在手动触发的多架构发布成功后才会移动。如需可复现部署和回滚，请固定到不可变 tag，例如 `webagentloop/nextrouter:latest-2026.07.16.1`。

> [!WARNING]
> 多机部署时**必须**设置 `SESSION_SECRET`（否则登录状态不一致）；共享 Redis **必须**设置 `CRYPTO_SECRET`（否则数据无法解密）。

📖 所有环境变量与部署方式，请见上游[环境变量](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables)与[安装](https://docs.newapi.pro/en/docs/installation)文档——它们同样适用于本 Fork。

---

## 📚 文档

上游文档涵盖了完整功能、API 参考与配置，并适用于 NextRouter：

| 分类 | 链接 |
|------|------|
| 🚀 部署指南 | [安装文档](https://docs.newapi.pro/en/docs/installation) |
| ⚙️ 环境配置 | [环境变量](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables) |
| 📡 API 文档 | [API 参考](https://docs.newapi.pro/en/docs/api) |
| ❓ 常见问题 | [FAQ](https://docs.newapi.pro/en/docs/support/faq) |

---

## 🔧 维护：如何跟踪上游

NextRouter 维护长期分支 `nextrouter`，持续合并 `upstream/main`。Fork 独有功能在 feature 分支（如 `feat/frontend-agent-loop`）开发后合并进 `nextrouter`。

当合并 fork-only 分支时，必须更新[相比上游的改进](#-nextrouter-相比上游的改进)章节。确切差异始终可由以下命令推导：

```bash
git log --oneline --no-merges upstream/main..HEAD
```

完整的多语言更新清单见 `AGENTS.md` → *Fork Documentation Maintenance*。

---

## 🤝 贡献

欢迎贡献！提交涉及 fork-only 功能的 PR 时：

1. 更新**全部**语言 README（`README.md`、`README.zh_CN.md`、`README.zh_TW.md`、`README.fr.md`、`README.ja.md`）中的 `<!-- FORK-DELTA -->` 区块——结构一致，仅语言不同。
2. 更新每个区块头部的 `Last verified` 日期。
3. 保留所有 new-api / QuantumNous 署名、上游链接与 AGPLv3 Section 7 声明。

---

## 📜 许可证

本项目基于 [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE) 授权。

AGPLv3 Section 7 的附加条款适用（见 [`NOTICE`](./NOTICE)）。修改版**必须保留**署名声明 `Frontend design and development by New API contributors.`，置于相应的法律声明及用户界面中任何显眼的关于、法律、页脚或署名位置。

提供用户界面的修改版还必须保留指向原始项目的可见链接：<https://github.com/QuantumNous/new-api>。

本项目是基于 [One API](https://github.com/songquanpeng/one-api)（MIT License）的开源项目。

---

## 🙏 致谢

NextRouter 构建于 **[new-api](https://github.com/QuantumNous/new-api)** 贡献者与 **[One API](https://github.com/songquanpeng/one-api)** 的工作之上，在此致谢。

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=WebAgentLoop/nextrouter&type=Date)](https://star-history.com/#WebAgentLoop/nextrouter&Date)

</div>

---

<div align="center">

<sub>构建于 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 之上 · Frontend design and development by New API contributors.</sub>

</div>
