# VirtualBoardGame日本語版 — フォークの状況まとめ

最終更新: 2026-11-24

## 概要

- 元: [jrmi/airboardgame](https://github.com/jrmi/airboardgame)（© Jérémie Pardou、MIT License）
- フォーク: [SexyNights/airboardgame](https://github.com/SexyNights/airboardgame)
- 分岐元のコミット: `97d536f`（2026-11-20 時点の本家 `master`）
- 方針: 本家の最新版をほぼそのまま使い、Docker 化と最小限の変更だけを載せる
  （本家の更新を取り込みやすくするため）
- 日本語訳は本家の `src/i18n/ja.json` を使う（追加したのは下記の 3 項目のみ）
- 表示名: 日本語表示では「VirtualBoardGame日本語版」

## 環境

| 環境 | 状態 | 構成 |
|---|---|---|
| PC（`~/abg`） | ビルド用 | `docker/build-nas-bundle.sh` で DS223j 用バンドルを作る |
| DS223j（ARM・1GB） | **試験運用中** | `http://192.168.0.3:8262`、`/volume1/docker/abg`、NAS ではビルドしない |
| DXP2800（Proxmox の Debian VM） | **公開予定（未実施）** | `https://vbg.tubg.net`、Cloudflare Tunnel（`docker-compose.public.yml`） |

手順の詳細は [docker/README.ja.md](../docker/README.ja.md)。

## 本家からの変更点

### ゲームの作成はメンバー限定
- 本家の仕様で、新しいゲームの作成・保存にはログインが必要
- ログインできるのは `ABG_ALLOWED_EMAILS` に書いたアドレスだけ（tubg.net 以外のアドレスも書ける）
- ログインボタンは隠しページ `/members` にだけ表示（`VITE_HIDE_LOGIN=1`、Docker の既定）
- セッション（既存ゲームで遊ぶ部屋）の作成はログイン不要のまま（本家の仕様）

### 名前と「このサイトについて」
- 表示名・ページタイトル・`manifest.json` を「VirtualBoardGame日本語版」に
  （翻訳キー `Air Board Game` / `ABG`。日本語以外の表示では元の名前）
- 「このサイトについて」を、非公式版である旨の文章に差し替え（翻訳キー `aboutFork`。
  日本語以外は英語の文章）。原作者の連絡先・ホスティング情報は出さない
- 右上の GitHub アイコンとゲーム画面の「ヘルプ・情報」は日本語版リポジトリへ。
  本家へのリンクは「このサイトについて」の「AirBoardGame」だけ
- 本家の Discord へのリンクは削除
- `<html lang>` とページタイトルを表示言語に連動
- `LICENSE.md`（MIT）はそのまま保持

### ログインとメール（バックエンド）
- `ABG_ALLOWED_EMAILS`: ログインできるアドレスの許可リスト
- `EMAIL_FROM`: 送信元（`tubg-vbg@tubg.net`）。ポート 465/2465 は SMTPS（Resend 対応）
- 同じアドレスへのログインリンクは 60 秒に 1 回まで（`ABG_LOGIN_INTERVAL_SECONDS`）
- `CLIENT_URL` が `https://` のとき Cookie に `Secure` を付ける
- ログイン用メールの日本語版

### 不具合の修正
- HTTP（LAN の IP アドレス）でも、画像を含むエクスポートと URL コピーが動くように
  （`crypto.subtle` / `navigator.clipboard` の代替処理）
- 未保存のゲームへのインポートが 404 になる問題（読み込み前に保存）
- 古いセッション（60 日）を削除するとき、そのアップロード画像も削除（`data/media` の直下だけ）

### 公開に向けた変更
- 検索エンジン除け（`robots.txt`、`<meta name="robots">`、`X-Robots-Tag`）
- アップロード上限 20MB（`MAX_UPLOAD_MB`）、nginx は 25MB
- ポートは 8262（公開構成では `127.0.0.1:8262` のみ、外部は Cloudflare Tunnel 経由）

### 以前のフォーク（`30b8928` ベース）から外したもの
- 独自の `ja.json`（本家の公式訳に置き換え）
- 言語フィルタ・Vassal リンク・背景画像・検索欄とスライダーを隠す設定
- トップのレイアウト変更、ゲーム一覧の「〇分」「〇歳以上」表記

## 設定ファイル（Git に含めない）

| ファイル | 場所 | 中身 |
|---|---|---|
| `.env.docker` | PC の `~/abg-arm/`、NAS、公開 VM | `CLIENT_URL`、`ABG_SECRET`、`ABG_ALLOWED_EMAILS`、SMTP（Resend） |
| `.env.tunnel` | 公開 VM のみ | `TUNNEL_TOKEN`（Cloudflare Tunnel） |

`ABG_SECRET` と Resend の API キーはチャットやリポジトリに貼らない。

## 運用メモ

- DS223j の更新: PC で `git pull` → `docker/build-nas-bundle.sh` → `scp -O ~/abg-arm.tar.gz ...`
  → NAS で `down` / `rm -rf html backend nginx.conf compose.yaml .env.docker` / `tar -xzf` / `up -d`
- メンバーの追加: `.env.docker` の `ABG_ALLOWED_EMAILS` を変更して `docker compose up -d`
  （PC の `~/abg-arm/.env.docker` も同じ内容にする）
- 本家の更新の取り込み: `git fetch upstream` → `git rebase upstream/master`（または merge）。
  変更は上記の範囲に絞ってあるので、競合は `HomeNav.jsx`・`AboutModal.jsx`・`i18n/*.json` 程度のはず
- DS223j から DXP2800 へ移すときは `data/` をそのままコピーし、`CLIENT_URL` を公開 URL にする

## 確認済み・注意点

- 2026-11-24: lint OK、フロントのテスト 104 件・バックエンドのテスト 22 件すべて成功、本番ビルド OK
- DS223j 方式は、バックエンドの依存パッケージに**ネイティブモジュールがない**前提
- 公開構成（Cloudflare Tunnel、HTTPS、`Secure` Cookie）は未検証
- 市販ゲームの画像を使ったゲームは「公開」にしない（著作権）
