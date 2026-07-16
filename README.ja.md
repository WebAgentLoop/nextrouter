<div align="center">

![new-api](/web/default/public/logo.png)

# NextRouter

🍥 **[new-api](https://github.com/QuantumNous/new-api) のローリングリリース拡張 Fork — LLM ゲートウェイ + ブラウザ側エージェントループ**

<p align="center">
  <a href="./README.zh_CN.md">简体中文</a> |
  <a href="./README.zh_TW.md">繁體中文</a> |
  <a href="./README.md">English</a> |
  <a href="./README.fr.md">Français</a> |
  <strong>日本語</strong>
</p>

<p align="center">
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-AGPLv3-brightgreen" alt="license">
  </a><!--
  --><a href="https://hub.docker.com/r/webagentloop/nextrouter">
    <img src="https://img.shields.io/badge/docker-webagentloop%2Fnextrouter-blue" alt="docker">
  </a><!--
  --><a href="https://github.com/QuantumNous/new-api">
    <img src="https://img.shields.io/badge/fork%20of-QuantumNous%2Fnew--api-orange" alt="QuantumNous/new-api の fork">
  </a>
</p>

<p align="center">
  <a href="#-nextrouter-とは">概要</a> •
  <a href="#-nextrouter-の新機能">新機能</a> •
  <a href="#-クイックスタート">クイックスタート</a> •
  <a href="#-メンテナンス上流の追跡">メンテナンス</a> •
  <a href="#-ライセンス">ライセンス</a>
</p>

</div>

> 🔄 **ローリングアップデート、上流を追跡。** NextRouter は [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api) の `main` を継続的にマージします。ローリングイメージタグ **`latest`** は直近の成功したリリース（上流 + fork の変更）を指します — `docker pull` で最新を維持し、再現可能なデプロイにはバージョン付きタグで固定してください。

> [!IMPORTANT]
> - 本プロジェクトは、合法的に許可された AI API ゲートウェイ、組織レベルの認証、マルチモデル管理、利用量分析、コスト管理、プライベートデプロイのシナリオのみを対象としています。
> - ユーザーは、上流の API キー、アカウント、モデルサービス、インターフェース権限を合法的に取得し、上流のサービス利用規約および適用される法律法規を遵守する必要があります。
> - 生成 AI サービスを公衆に提供する場合、ユーザーは適用される規制要件を遵守し、管轄区域で求められる届出、ライセンス、コンテンツセキュリティ、本人確認、ログ保持、税務、上流認可などのすべての義務を履行してください。

---

## 🧭 NextRouter とは

**NextRouter** は [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api) のコミュニティ Fork で、上流の `main` を継続的に追跡します。new-api が提供するすべての機能—統一 API の背後での 40 以上の上流 AI プロバイダー（OpenAI、Claude、Gemini、Azure、AWS Bedrock など）の集約、ユーザー管理、課金、レート制限、管理ダッシュボード—を維持しつつ、ゲートウェイとフロントエンドに焦点を当てた一連の機能強化を追加します（[新機能](#-nextrouter-の新機能) を参照）。

完全な機能セット、モデルサポート、API 形式、設定については、**上流ドキュメント**を参照してください：<https://docs.newapi.pro/en/docs>。

---

## 🌓 本 Fork について・上流との関係

NextRouter は [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api)（AGPLv3）をベースにしており、これはさらに [One API](https://github.com/songquanpeng/one-api)（MIT）をベースとしています。本 Fork は次の通りです：

- 上流の `main` を継続的に追跡します。Fork 固有の変更は自己完結しており、以下に列挙します。
- 自身の変更に責任を持ち、AGPLv3 第 7(c) 条に従って変更を明示します。
- **必須の帰属表示を保持します：** `Frontend design and development by New API contributors.`
- **オリジナルプロジェクトへの可視リンクを保持します：** <https://github.com/QuantumNous/new-api>

完全な条件は [ライセンス](#-ライセンス) と [`NOTICE`](./NOTICE) を参照してください。

---

<!-- FORK-DELTA: NextRouter changes vs upstream QuantumNous/new-api.
     Update after merging any fork-only branch.
     Completeness check: git log --oneline --no-merges upstream/main..HEAD
     Last verified: 2026-07-16 -->

## ✨ NextRouter の新機能

> 以下は上流との差分のみを扱います。上流の機能については公式ドキュメントを参照してください。

### 🤖 ブラウザ側エージェントループ

新しい **Agent** サイドバーモジュール（`/agent`、*Profile → Sidebar modules* で切替可能）は、完全にブラウザ内で動作するエージェント会話ループを実装します。

- playground relay `/pg/chat/completions` を OpenAI function-calling 形式で再利用し、ビルトインのツールレジストリと**電卓**ツール（安全な式評価）を同梱。
- ツール呼び出しをストリーミング解析し、各アシスタントターンを折りたたみ可能な **Process** パネル付きの 1 枚のカードに集約。
- メッセージ操作：コピー / 再生成 / 編集（再送の有無を選択可） / 削除。
- 複数セッションの履歴を **IndexedDB** に永続化（最大 50 セッション）、リネーム / 切替 / 削除に対応。
- 反復回数の上限がツール呼び出しの無限ループを防止し、7 言語にローカライズ。

### ⚡ チャネル・Relay の強化

- **Force Stream**（チャネル設定）：ストリーミングのみをサポートする上流向けに、クライアントが非ストリーミングリクエストを送信した際、ゲートウェイが SSE ストリームをバッファリングして単一の非ストリーミング JSON レスポンスを返します（バックエンドのバッファリングロジック + ユニットテスト付き）。
- **Force Format / Force Stream** の切替が **Advanced Custom** チャネルでも利用可能になりました（以前は OpenAI チャネルのみ）。
- `/pg/chat/completions` が Advanced Custom の受信パスオプションとして追加されました。

### 🧩 モデル管理

- **ベンダー管理ダイアログ**：全モデルベンダーを一覧表示し、編集 / 削除 / 追加に対応（以前は作成のみ）、エラー時のリトライ付き。
- **エンドポイントテンプレートのマージ**：保存時にすべて置換ではなくマージするよう変更し、既存のエンドポイント JSON が不正な場合はマージ前に警告します。

### 💰 ウォレットと決済

- カスタム通貨（CUSTOM）モードと Waffo Pancake 決済プロバイダーのウォレット金額表示を修正。

### 📦 リリースとデプロイ

- 手動 Docker リリースワークフローは amd64 / arm64 イメージをネイティブにビルドして署名し、マルチアーキテクチャ manifest の成功後にのみ `latest` を更新します。
- 各リリースは不変の `latest-YYYY.MM.DD.N` イメージタグと、分類済みの変更、イメージ digest、ロールバックコマンドを含む GitHub Release を作成します。

<!-- /FORK-DELTA -->

---

## 🚀 クイックスタート

### Docker Compose を使う（推奨）

```bash
# Fork をクローン
git clone https://github.com/WebAgentLoop/nextrouter.git
cd nextrouter

# docker-compose.yml の設定を編集
nano docker-compose.yml

# サービスを起動
docker-compose up -d
```

<details>
<summary><strong>Docker コマンドを使う</strong></summary>

```bash
# 最新イメージを取得
docker pull webagentloop/nextrouter:latest

# SQLite を使う場合（デフォルト）
docker run --name nextrouter -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  webagentloop/nextrouter:latest

# MySQL を使う場合
docker run --name nextrouter -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  webagentloop/nextrouter:latest
```

> **💡 ヒント：** `-v ./data:/data` はデータを現在のディレクトリの `data` フォルダに保存します。`-v /your/custom/path:/data` のように絶対パスも使用できます。

</details>

デプロイ完了後、`http://localhost:3000` にアクセスして利用を開始します。

---

## 📦 イメージとデプロイ

| コンポーネント | 要件 |
|------|------|
| **イメージ** | `webagentloop/nextrouter:latest` |
| **ローカルデータベース** | SQLite（Docker は `/data` ディレクトリをマウント必須） |
| **リモートデータベース** | MySQL ≥ 5.7.8 または PostgreSQL ≥ 9.6 |
| **コンテナエンジン** | Docker / Docker Compose |
| **アーキテクチャ** | 64 ビットのみ（amd64 / arm64）、32 ビットは非対応 |

> [!TIP]
> `latest` は、手動で開始したマルチアーキテクチャリリースが成功した場合にのみ移動する**ローリングリリースタグ**です。再現可能なデプロイとロールバックには、`webagentloop/nextrouter:latest-2026.07.16.1` のような不変タグで固定してください。

> [!WARNING]
> マルチマシンデプロイでは `SESSION_SECRET` を**必ず**設定してください（そうしないとログイン状態が不整合になります）。共有 Redis では `CRYPTO_SECRET` を**必ず**設定してください（そうしないとデータを復号できません）。

📖 すべての環境変数とデプロイ方法については、上流の [環境変数](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables) および [インストール](https://docs.newapi.pro/en/docs/installation) ガイドを参照してください—これらは本 Fork にも適用されます。

---

## 📚 ドキュメント

上流ドキュメントは完全な機能セット、API リファレンス、設定を網羅しており、NextRouter にも適用されます：

| カテゴリ | リンク |
|------|------|
| 🚀 デプロイガイド | [インストール](https://docs.newapi.pro/en/docs/installation) |
| ⚙️ 環境設定 | [環境変数](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables) |
| 📡 API ドキュメント | [API リファレンス](https://docs.newapi.pro/en/docs/api) |
| ❓ FAQ | [FAQ](https://docs.newapi.pro/en/docs/support/faq) |

---

## 🔧 メンテナンス：上流の追跡

NextRouter は `upstream/main` を継続的にマージする長期ブランチ `nextrouter` を維持します。Fork 固有の機能は feature ブランチ（例：`feat/frontend-agent-loop`）で開発され、`nextrouter` にマージされます。

Fork 専用ブランチをマージする際、[新機能](#-nextrouter-の新機能) セクションを更新する必要があります。正確な差分は常に以下から導出できます：

```bash
git log --oneline --no-merges upstream/main..HEAD
```

完全な多言語更新チェックリストは `AGENTS.md` → *Fork Documentation Maintenance* を参照してください。

---

## 🤝 コントリビュート

コントリビューションを歓迎します！Fork 専用機能を追加・変更する PR を開く際は：

1. **すべて**の言語の README（`README.md`、`README.zh_CN.md`、`README.zh_TW.md`、`README.fr.md`、`README.ja.md`）の `<!-- FORK-DELTA -->` ブロックを更新してください—構造は同じで、言語のみ異なります。
2. 各ブロックの `Last verified` 日付を更新してください。
3. すべての new-api / QuantumNous の帰属、上流リンク、AGPLv3 Section 7 の通知を保持してください。

---

## 📜 ライセンス

本プロジェクトは [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE) の下でライセンスされています。

AGPLv3 Section 7 に基づく追加条項が適用されます（[`NOTICE`](./NOTICE) を参照）。修正版は、適切な法的通知およびユーザーインターフェースに表示される目立つ「について」、法的、フッター、帰属の各場所に、帰属表示 `Frontend design and development by New API contributors.` を**保持しなければなりません**。

ユーザーインターフェースを表示する修正版は、オリジナルプロジェクトへの可視リンクも保持しなければなりません：<https://github.com/QuantumNous/new-api>。

本プロジェクトは [One API](https://github.com/songquanpeng/one-api)（MIT License）をベースとしたオープンソースプロジェクトです。

---

## 🙏 謝辞

NextRouter は **[new-api](https://github.com/QuantumNous/new-api)** のコントリビューターと **[One API](https://github.com/songquanpeng/one-api)** の成果の上に構築されています。感謝いたします。

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=WebAgentLoop/nextrouter&type=Date)](https://star-history.com/#WebAgentLoop/nextrouter&Date)

</div>

---

<div align="center">

<sub>[QuantumNous/new-api](https://github.com/QuantumNous/new-api) 上に構築 · Frontend design and development by New API contributors.</sub>

</div>
