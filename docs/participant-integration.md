# 認証サーバーと参加アプリの統合テスト

この資料は、このリポジトリの認証サーバーと、別プロジェクトの参加アプリをローカルで同時に動かし、ブラウザで引き渡しと入場を確認する手順です。認証サーバー単体の自動テストと手動確認は [testing.md](./testing.md) です。

参加アプリ本体はこのリポジトリにありません。参加アプリは HTTP のイントロスペクションを呼ばず、認証サーバーと同じ PostgreSQL と Redis を直接読みます。実装の契約は [planning/participant-app.md](../planning/participant-app.md) です。引き渡しの条件は [specification.md](./specification.md) の「引き渡し `GET /auth/handoff`」、接続権限は [redis.md](./redis.md) の「参加アプリの接続権限」です。

ここでは開発サーバー `pnpm dev` を使います。`NODE_ENV` は `production` にしません。

## ローカルのホスト

| 役割 | オリジン | アプリ ID |
|------|----------|-----------|
| 認証サーバー | `http://auth.localhost:3000` | `auth`（`.env` の `APP_ID`） |
| 参加アプリ | `http://app.localhost:4000` | `demo`（参加アプリの `APP_ID`。`auth` は使えない） |

参加アプリのホストは `PARENT_DOMAIN`（開発既定 `localhost`）の直下 1 ラベルです。頂点の `localhost` は登録できません。`__Host-session` はホスト単位で、ポートでは分かれません。

ポートを 4000 以外にするときは、参加アプリのオリジン、戻り先 URL、`APP_ORIGIN` を同じポートに揃えます。

ブラウザは Chrome または Edge を使います。どちらも `*.localhost` をループバックとして開くので、hosts の追加は要りません。パスキーの登録にはブラウザのパスキー UI が必要です。`http://auth.localhost` と `http://app.localhost` は安全なコンテキストとして扱われ、`Secure` の `__Host-` Cookie を発行できます。

## 1. PostgreSQL と Redis

自動テスト用のデータベース `astro_webauthn_test` とは別に、手動確認用のデータベースを作ります。`pnpm test:integration` は `TEST_DATABASE_URL` のデータを消します。

```bash
docker compose -f docker-compose.db.yaml up -d
docker compose -f docker-compose.db.yaml exec postgres psql -U postgres -c "CREATE DATABASE astro_webauthn"
```

`astro_webauthn` が既にあるときは、2 行目は省略します。compose が最初から作るデータベースは `astro_webauthn_test` です。Redis はパスワードなしで `localhost:6379` に出ます。

## 2. 認証サーバーの環境変数

`.env.example` を `.env` にコピーし、少なくとも次を設定します。

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/astro_webauthn?schema=public"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/astro_webauthn_test?schema=public"
REDIS_URL="redis://localhost:6379/"
PARTICIPANT_REDIS_PASSWORD="participant-redis-local"
APP_URL="http://auth.localhost:3000"
APP_ID="auth"
PARENT_DOMAIN="localhost"
WEBAUTHN_RP_ID="auth.localhost"
WEBAUTHN_RP_NAME="認証サーバー"
WEBAUTHN_ORIGIN="http://auth.localhost:3000"
MAIL_MODE="console"
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="admin-change-me"
```

`DATABASE_URL` は読み書きできるユーザーのままです。参加アプリ用ロールには切り替えません。`PARTICIPANT_REDIS_PASSWORD` は、参加アプリ共通の Redis ユーザー `app_participant` のパスワードです。未設定のときは、このユーザーを作りません。PostgreSQL の `app_participant` のパスワードとは別の値にします。`REDIS_KEY_PREFIX` を付けるときは、参加アプリも同じ値にします。未設定のままが、この手順の既定です。

## 3. 認証サーバーのデータベース

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

`pnpm db:seed` は、認証サーバー自身の `App` 行を用意します。管理者は User が 0 件のときだけ作り、`AppGrant` は付けません。

共有テーブルができたあと、参加アプリ用の PostgreSQL ロールを一度作ります。ひな型は [planning/participant/participant-access.sql](../planning/participant/participant-access.sql) です。開発用データベースに対して、次を実行します。

```bash
docker compose -f docker-compose.db.yaml exec postgres psql -U postgres -d astro_webauthn
```

```sql
CREATE ROLE app_participant LOGIN PASSWORD 'participant-pg-local';
GRANT CONNECT ON DATABASE astro_webauthn TO app_participant;
GRANT USAGE ON SCHEMA public TO app_participant;
GRANT SELECT (id, email, name, role, "disabledAt") ON TABLE "User" TO app_participant;
GRANT SELECT (id, "userId") ON TABLE "WebAuthnCredential" TO app_participant;
GRANT SELECT ON TABLE "App", "AppGrant" TO app_participant;
```

ロールが既にあるときは `CREATE ROLE` を飛ばし、`GRANT` だけ再実行します。共有テーブルを作り直したあとも、`GRANT` を再実行します。このロールは認証サーバーの起動処理では作りません。

## 4. 認証サーバーの起動

```bash
pnpm dev
```

表示される待受 URL は `http://localhost:3000` です。ページを開くと `http://auth.localhost:3000` に移ります。ログインとパスキー登録は、移ったあとのホストで行います。

初回の HTTP リクエストで、`PARTICIPANT_REDIS_PASSWORD` から Redis ユーザー `app_participant` を用意します。参加アプリを起動する前に、`http://auth.localhost:3000` を一度開きます。

seed 管理者でログインします。

1. `http://auth.localhost:3000/login` を開く
2. `SEED_ADMIN_EMAIL` を入れて続行する
3. パスワード欄に `SEED_ADMIN_PASSWORD` を入れる
4. `/setup-passkey` でパスキーを登録する

パスキーが無いセッションは、参加アプリへ引き渡しません。招待メールを試すときは、`MAIL_MODE=console` のため本文は認証サーバーのログに出ます。

## 5. 参加アプリの登録

パスキー登録後、管理者で `http://auth.localhost:3000/admin/apps` を開きます。

「アプリを登録」に次を入れます。

| 項目 | 値 |
|------|-----|
| アプリ ID | `demo` |
| 表示名 | 任意（例: 参加アプリ） |
| オリジン | `http://app.localhost:4000` |
| 戻り先 URL | `http://app.localhost:4000/callback` |
| 既定の利用許可 | 利用を許可しない（個別のみ） |

戻り先 URL は 1 行に 1 件です。オリジンと完全に一致させ、クエリとフラグメントは付けません。

この既定では、例外の行が無い利用者は入場できません。画面下の「利用許可」で、seed 管理者と `demo` を選び、利用許可を「利用可」にして保存します。

全員を入れる確認をするときは、既定を「全利用者に利用を許可」にします。確認ダイアログは「例外がない現在および今後の全利用者に利用が付きます」です。共通ロールだけでは入場しません。

## 6. 参加アプリの起動

参加アプリのプロジェクトで、認証サーバーと同じデータベースと Redis へ、制限されたユーザーで接続します。

```env
APP_ID="demo"
APP_ORIGIN="http://app.localhost:4000"
AUTH_ORIGIN="http://auth.localhost:3000"
DATABASE_URL="postgresql://app_participant:participant-pg-local@localhost:5432/astro_webauthn?schema=public"
REDIS_URL="redis://app_participant:participant-redis-local@localhost:6379/"
SESSION_MAX_AGE_SECONDS="2592000"
```

`APP_ID`、`APP_ORIGIN`、戻り先は、手順 5 で登録した `App` 行と一致させます。`REDIS_KEY_PREFIX` は認証サーバーと同じにします。

参加アプリの開発サーバーを、ポート 4000 で起動します。待ち受けはループバックで、`Host: app.localhost` のリクエストを受けます。起動コマンドは、そのプロジェクトの手順に従います。

## 7. 確認手順

認証サーバーと参加アプリの両方が起動している状態で、同じブラウザから確認します。

1. 未ログインのブラウザで `http://app.localhost:4000/` を開く。参加アプリはログイン画面を出さず、`http://auth.localhost:3000/auth/handoff` へ移る。セッションが無ければ認証サーバーのログインへ進み、ログイン後に同じ引き渡しへ戻る。
2. パスキーがあり、手順 5 の利用許可が「利用可」なら、`http://app.localhost:4000/callback` を経て参加アプリの画面に戻る。表示は、その利用者のメールアドレス、名前、共通ロールである。
3. 利用許可の行を削除するか「利用不可」にして、参加アプリを再読み込みする。次のリクエストから「このアプリを利用する権限がありません」になる。セッションの作り直しは要らない。
4. 利用許可を「利用可」に戻し、参加アプリでログアウトする。参加アプリは「ログアウトしました」を出し、この画面から引き渡しを始めない。認証サーバーの `http://auth.localhost:3000` を開くと、未ログインである。
5. 参加アプリで再度ログインしたあと、認証サーバーでログアウトする。参加アプリを開くと、セッションが無く、手順 1 の引き渡しが再び始まる。

追加で見る点:

| 操作 | 結果 |
|------|------|
| パスキー登録前に参加アプリを開く | 認証サーバーの `/setup-passkey` に留まり、参加アプリへ戻らない |
| アプリ未登録、戻り先 URL の不一致、実効許可が無い | 認証サーバーが 403「引き渡し先のアプリを利用できません」。参加アプリへは戻らない |
| 管理者でアカウントを無効化する | その利用者の全セッションが失効し、参加アプリも認証サーバーも未ログインになる |

引き渡しコードは 60 秒で一度だけ使えます。戻り先で「引き渡しに失敗しました」と出たときは、参加アプリの画面から引き渡しをやり直します。
