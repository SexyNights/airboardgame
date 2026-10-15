# VirtualBoardGame日本語版 — フォークの状況まとめ

最終更新: 2026-10-15

## 概要

- 元: [jrmi/airboardgame](https://github.com/jrmi/airboardgame)（© Jérémie Pardou、MIT License）
- フォーク: [SexyNights/airboardgame](https://github.com/SexyNights/airboardgame)（`master` ブランチのみ）
- 分岐元のコミット: `30b8928`（Improve grid management and generator #475）
- 目的: UI を日本語化し、原作者に迷惑がかからない非公式版として自宅サーバーで運用する
- 表示名: 日本語表示では「VirtualBoardGame日本語版」（英語・フランス語表示は元の名前のまま）
- ゲームデータ（各ゲームの名前・説明・素材）は日本語化しない方針

## 環境

| 環境 | 状態 | 構成 |
|---|---|---|
| PC（`~/abg`） | ビルド用 | `docker/build-nas-bundle.sh` で DS223j 用バンドルを作る |
| DS223j（ARM・1GB） | **試験運用中** | `http://192.168.0.3:8262`、`/volume1/docker/abg`、NAS ではビルドしない |
| DXP2800（Proxmox の Debian VM） | **公開予定（未実施）** | `https://vbg.tubg.net`、Cloudflare Tunnel（`docker-compose.public.yml`） |

手順の詳細は [docker/README.ja.md](../docker/README.ja.md)。

## 主な変更点

### 日本語化
- `src/i18n/ja.json` を追加。ブラウザの言語に毎回従う（言語を記憶しない）。確認用に `?lng=ja|en|fr`
- `<html lang>` とページタイトルを表示言語に連動
- ログイン用メールの日本語版、ゲーム一覧の「〇分」「〇歳以上」表記
- ゲーム設定の「素材の言語」「既定の言語」「翻訳」に日本語を追加（一覧では `JP`）

### 原作者に迷惑をかけないための変更
- 「このサイトについて」を、非公式版である旨の文章に差し替え（原作者の連絡先・ホスティング情報は出さない）
- 原作者のリポジトリへのリンクは「このサイトについて」の「AirBoardGame」だけ。右上の GitHub アイコンと
  ゲーム画面の「ヘルプ・情報」は日本語版リポジトリへ
- `LICENSE.md`（MIT）はそのまま保持

### 表示の切り替え（ビルド時の設定、`1` = 非表示）

| 変数 | 本家の既定 | Docker / バンドルの既定 | 対象 |
|---|---|---|---|
| `VITE_HIDE_LOGIN` | 0 | 1 | ログインボタン（`/members` では常に表示） |
| `VITE_HIDE_LANGUAGE_FILTER` | 0 | 1 | ゲーム一覧の言語フィルタ |
| `VITE_HIDE_ABOUT` | 0 | 0 | 「このサイトについて」 |
| `VITE_HIDE_VASSAL_LINK` | 0 | 1 | トップの「Vassalモジュールを読み込む」 |
| `VITE_HIDE_HERO_IMAGE` | 0 | 1 | トップ見出しの背景画像（非表示時は黒） |
| `VITE_HIDE_GAME_FILTERS` | 0 | 1 | 検索欄、プレイ人数・プレイ時間のスライダー |

非表示にした絞り込みは適用しない（隠れた初期値でゲームが消えないように）。
Docker では `ABG_HIDE_*=0 docker compose up -d --build`、バンドルでは
`ABG_HIDE_*=0 docker/build-nas-bundle.sh` のように切り替える。

### ログインとメール（バックエンド）
- `/members` だけにログインボタンを出す
- `ABG_ALLOWED_EMAILS`: ログインできるアドレスの許可リスト
- `EMAIL_FROM`: 送信元（`abg@tubg.net`）。ポート 465/2465 は SMTPS（Resend 対応）
- 同じアドレスへのログインリンクは 60 秒に 1 回まで（`ABG_LOGIN_INTERVAL_SECONDS`）
- `CLIENT_URL` が `https://` のとき Cookie に `Secure` を付ける

### 不具合の修正
- HTTP（LAN の IP アドレス）でも、画像を含むエクスポートと URL コピーが動くように
  （`crypto.subtle` / `navigator.clipboard` の代替処理）
- 未保存のゲーム・セッションへのインポートが 404 になる問題（読み込み前に保存）
- 古いセッション（60 日）を削除するとき、そのアップロード画像も削除（`data/media` の直下だけ）

### 公開に向けた変更
- 検索エンジン除け（`robots.txt`、`<meta name="robots">`、`X-Robots-Tag`）
- アップロード上限 20MB（`MAX_UPLOAD_MB`）、nginx は 25MB
- ポートは 8262（公開構成では `127.0.0.1:8262` のみ、外部は Cloudflare Tunnel 経由）
- トップのレイアウト変更（見出し文言、「このサイトについて」の位置、スマートフォン表示）

## 設定ファイル（Git に含めない）

| ファイル | 場所 | 中身 |
|---|---|---|
| `.env.docker` | PC の `~/abg-arm/`、NAS、公開 VM | `CLIENT_URL`、`ABG_SECRET`、`ABG_ALLOWED_EMAILS`、SMTP（Resend） |
| `.env.tunnel` | 公開 VM のみ | `TUNNEL_TOKEN`（Cloudflare Tunnel） |

`ABG_SECRET` と Resend の API キーはチャットやリポジトリに貼らない。

## 運用メモ

- DS223j の更新: PC で `git pull` → `docker/build-nas-bundle.sh` → `scp -O ~/abg-arm.tar.gz ...`
  → NAS で `down` / `rm -rf html backend nginx.conf compose.yaml .env.docker` / `tar -xzf` / `up -d`
- DS223j では `html` などが root 所有になるので、削除には `sudo` が必要
- メンバーの追加: `.env.docker` の `ABG_ALLOWED_EMAILS` を変更して `docker compose up -d`
  （PC の `~/abg-arm/.env.docker` も同じ内容にする）
- 本家の更新の取り込み:
  `git remote add upstream https://github.com/jrmi/airboardgame.git`（初回）→
  `git pull upstream master` → 競合を解消 → `ja.json` に新しい文言を追加
- DS223j から DXP2800 へ移すときは `data/` をそのままコピーし、`CLIENT_URL` を公開 URL にする

## 注意点・未確認事項

- DS223j 方式は、バックエンドの依存パッケージに**ネイティブモジュールがない**前提（PC で作った
  ものを ARM で動かしている）。本家の更新で追加されたら、ARM 向けビルドに切り替える
- バックエンドのテストは 22 件すべて成功（2026-10-15、Node.js 22）。PC の Node.js が古い場合は
  Docker で実行する:
  `docker run --rm -v "$PWD/backend":/app -v /app/node_modules -w /app node:22-bookworm-slim sh -c "npm ci && npm test"`
- 公開構成（Cloudflare Tunnel、HTTPS、`Secure` Cookie）は未検証
- フォークの GitHub Issues は既定で無効。問い合わせ先にするなら Settings → Features で有効化
- GitHub の Claude アプリのアクセス範囲は「Only select repositories」に絞っておく
- 市販ゲームの画像を使ったゲームは「公開」にしない（著作権）
