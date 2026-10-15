# Docker で動かす（日本語化フォーク）

```sh
git clone https://github.com/SexyNights/airboardgame.git abg
cd abg
cp .env.docker.example .env.docker   # ABG_SECRET を変更
mkdir -p data/db data/media
docker compose up -d --build
```

ブラウザで http://localhost:8262 を開く。

- フロント（nginx）とバックエンド（Node）の2コンテナ構成。nginx が `/airboardgame/`・`/socket.io/`・`/health` をバックエンドへプロキシする。
- データは `./data`（NeDB と画像）。別の場所に置く場合は `ABG_DATA_DIR=/srv/abg-data docker compose up -d` のように指定する。
- Linux では `data` を uid 1000 の所有にしておく: `sudo chown -R 1000:1000 data`
- 公開ポートは `ABG_PORT` で変更できる（既定 8262）。
- ログイン・言語フィルタ・Vassal リンクは既定で非表示（「このサイトについて」は表示）。ビルド時に表示へ切り替えられる
  （例: `ABG_HIDE_LOGIN=0 docker compose up -d --build`、または
  `docker build --build-arg VITE_HIDE_LOGIN=0 ...`）。
- ログインは `EMAIL_HOST=fake` のままだとメールを送らず、ログインリンクがバックエンドのログに出る。
- 更新: `git pull && docker compose up -d --build`

## ARM の NAS（Synology DS223j など）で動かす

DS223j はメモリ 1GB の ARM 機なので NAS 上ではビルドしない。PC でアプリを
ビルドし、中身（`html`・`backend`）だけを NAS に持ち込んで、NAS では公式の
`node` / `nginx` イメージ（ARM 版が自動で使われる）に載せて動かす。

### PC: バンドルを作る

```sh
cd ~/abg && git pull
docker/build-nas-bundle.sh            # → ~/abg-arm/ と ~/abg-arm.tar.gz
```

初回は `~/abg-arm/.env.docker` が例から作られるので、`CLIENT_URL`
（`http://<NASのIP>:8262`）と `ABG_SECRET`（`openssl rand -hex 32`）を編集して
もう一度スクリプトを実行する。2 回目以降は既存の `.env.docker` が引き継がれる。

既定ではログイン・言語フィルタ・トップページの「Vassalモジュールを読み込む」
リンク・背景のゲーム箱の画像・ゲームの検索欄とプレイ人数/プレイ時間のスライダーは非表示。「このサイトについて」は、非公式版である旨と日本語版の
ソースコードへのリンクを表示する。ログインボタンは隠しページ
`http://<NASのIP>:8262/members` を開いたときだけ表示される。
変える場合は `ABG_HIDE_LOGIN=1 docker/build-nas-bundle.sh` のように指定する。

### PC → NAS: 転送

```sh
scp -O ~/abg-arm.tar.gz <ユーザー>@<NASのIP>:/volume1/docker/
```

DSM は既定で SFTP が無効なので `-O`（従来方式）が必要。

### NAS: 展開して起動（SSH）

```sh
sudo mkdir -p /volume1/docker/abg && cd /volume1/docker/abg
sudo docker compose down 2>/dev/null || true
sudo rm -rf html backend nginx.conf compose.yaml .env.docker
sudo tar -xzf /volume1/docker/abg-arm.tar.gz
sudo mkdir -p data/db data/media
sudo docker compose up -d
```

`data`（ゲーム・セッション・画像）は残る。更新時も同じ手順でよい。
`docker compose` が無ければ `docker-compose` を使う。

### 注意点

- バックエンドはコンテナ内で root として動かしている。DSM の共有フォルダの
  ACL により、uid 1000 では `chown` しても `data` に書き込めないことがあるため。
- `html` などは NAS 上では root 所有になるので、消すときは `sudo` が必要。
- ログインは `EMAIL_HOST=fake` のままだとメールを送らず、リンクがログに出る:
  `sudo docker compose logs backend | grep "Authentication link"`（15 分有効）。
- メールで送る場合は `.env.docker` に SMTP を設定する（Resend の例は
  `.env.docker.example` を参照）。`EMAIL_FROM` で送信元を指定でき、
  `ABG_ALLOWED_EMAILS` に書いたアドレスだけがログインできる。
- HTTP（`http://<NASのIP>:8262`）でも、エクスポートへの画像同梱と URL コピーが
  動くようにしてある（ブラウザの安全なコンテキスト限定 API を使わない代替処理）。

## インターネットに公開する（DXP2800 / Proxmox の Debian VM、Cloudflare Tunnel）

x86_64 の VM ではそのまま `docker compose up -d --build` で動く（NAS 用バンドルは不要）。
公開は Cloudflare Tunnel（`cloudflared` コンテナ）で行うので、ルーターのポート開放や
証明書の用意は不要。`tubg.net` の DNS が Cloudflare 管理であることが前提。

構成:

```
ブラウザ ─HTTPS─ Cloudflare ─トンネル─ cloudflared ─→ frontend(nginx) ─→ backend
                 (vbg.tubg.net)            └───── 同じ Docker ネットワーク内 ─────┘
```

`docker-compose.public.yml` を重ねると `cloudflared` が加わり、frontend の
ホスト側ポート 8262 は VM 自身（127.0.0.1）からだけ使えるようになる
（VM の外からは直接つながらず、公開は Cloudflare 経由のみ）。

### 1. Cloudflare でトンネルを作る

1. Cloudflare ダッシュボード → Zero Trust → Networks → Tunnels → 「Create a tunnel」
   （種類は Cloudflared、名前は例: `vbg`）。
2. 表示されるインストールコマンドの `--token` の後ろの文字列（トンネルトークン）を控える。
3. 「Public Hostname」を追加:
   - Subdomain: `vbg` / Domain: `tubg.net`
   - Service: `HTTP` / URL: `frontend:80`

### 2. VM で準備する

```sh
# データを置くディスク（例: t4data 上の追加ディスクを /srv/stacks にマウント済み）
cd /srv/stacks
git clone https://github.com/SexyNights/airboardgame.git abg
cd abg
cp .env.docker.example .env.docker
cp .env.tunnel.example .env.tunnel     # TUNNEL_TOKEN=<トンネルトークン>
mkdir -p data/db data/media && sudo chown -R 1000:1000 data
echo "COMPOSE_FILE=docker-compose.yml:docker-compose.public.yml" > .env
```

最後の行で、以後は `docker compose ...` だけで公開用の構成になる。

`.env.docker` の主な設定:

```
CLIENT_URL=https://vbg.tubg.net        # https にすると Cookie に Secure が付く
ABG_SECRET=<openssl rand -hex 32>
ABG_ALLOWED_EMAILS=a@example.com,b@example.com
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=465
EMAIL_USER=resend
EMAIL_PASSWORD=<Resend の送信専用 API キー>
EMAIL_FROM=abg@tubg.net
```

`.env.docker` と `.env.tunnel` には秘密情報が入るので、Git には含めない（`.gitignore` 済み）。

### 3. 起動・更新

```sh
docker compose up -d --build           # 起動
docker compose logs -f cloudflared     # トンネル接続の確認（Registered tunnel connection）
git pull && docker compose up -d --build   # 更新
```

既定の表示設定: ログイン（`/members` でのみ表示）・言語フィルタ・Vassal リンク・
背景画像・検索欄とスライダーは非表示、「このサイトについて」は表示。

### 公開時の注意

- Proxmox や NAS の管理画面はトンネルに載せない。
- 検索エンジンには登録させない（`robots.txt` で全拒否、`<meta name="robots">` と
  `X-Robots-Tag: noindex, nofollow` を付与）。
- アップロードは 1 ファイル 20MB まで（`MAX_UPLOAD_MB`）、nginx は 25MB まで受け付ける。
- 同じアドレスへのログインリンクは 60 秒に 1 回まで（`ABG_LOGIN_INTERVAL_SECONDS`）。
- 60 日以上更新のないセッションは、アップロード画像とともに自動削除される。
- `data` を定期的にバックアップする（VM ごと vzdump、または `data` をコピー）。
- DS223j（試験環境）から移行する場合は、DS223j の `data/` をそのまま VM の `data/` に
  コピーすればゲームとセッションを引き継げる（`.env.docker` の `CLIENT_URL` は公開 URL に変更）。
