# Mono Task (GraphQLバージョン)

Express, React, Sequelize, SQLite, TypeScriptを使用したタスク管理アプリケーションです。
GraphQL API設計によって、オーバーフェッチやアンダーフェッチを解消します。
オーバーフェッチやアンダーフェッチのパフォーマンスへの影響を学習・観察するために作りました。

## 特徴

* **基本的なタスク管理**: タスクの作成、読み取り、更新、削除（CRUD）。
* **詳細情報**: タイトル、詳細（Description）、期限日、場所、ステータス。
* **タグ機能**: タスクへのタグ付けと、タグによるフィルタリング。
* **検索機能**: キーワードによるタスク検索。
* **N+1問題の再現**:
    * 一覧APIは「ID、タイトル、期限日」のみを返します。
    * フロントエンドはリスト取得後、各タスクについて個別に詳細APIを叩き、詳細情報（場所、タグ、説明文）を取得します。
* **可視化**: Axios Interceptorsを使用し、ブラウザのコンソールにリクエスト/レスポンスのログを色付きで出力します。

## 技術スタック

### Backend (`/server`)
* **Runtime**: Node.js
* **Framework**: Express
* **Language**: TypeScript
* **Database**: SQLite
* **ORM**: Sequelize

### Frontend (`/client`)
* **Framework**: React (Vite)
* **Language**: TypeScript
* **HTTP Client**: Axios

## インストールと起動方法

プロジェクトのルートディレクトリで以下の手順を実行してください。

### 1. バックエンド (Server) の起動

```bash
cd server

#依存パッケージのインストール
npm install

# サーバー起動 (ポート: 3010)
# 初回起動時に database.sqlite が作成され、ダミーデータが投入されます。
npx ts-node src/index.ts
```

### 2. バックエンド (Server) の起動
```bash
cd client

# 依存パッケージのインストール
npm install

# 開発サーバーの起動
npm run dev
```
起動後、ブラウザで [http://localhost:5174](http://localhost:5174)（または表示されたURL）にアクセスしてください。