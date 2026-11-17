# データベースの初期化

この手順は、認証サーバーと参加アプリで共通です。同じ PostgreSQL を使い、接続ユーザーは分けます。参加アプリ側の同じ文書は、ロール見本の `docs/db-init.md` です。

## 接続

| 側 | 接続 | 起動時にすること |
| --- | --- | --- |
| 認証サーバー | 読み書きできるユーザー | `public` の共有テーブルをマイグレーションする |
| 参加アプリ | `app_participant` | そのアプリのスキーマにある未適用のマイグレーションだけを適用する |

認証サーバーの起動処理は、ロール `app_participant` を作りません。参加アプリの起動処理は、ロールもスキーマも作りません。管理者の接続文字列は、参加アプリの本番環境変数に置きません。

読み書きできる接続文字列を参加アプリにも置くと、画面の参照とそのアプリのマイグレーションは動作します。アプリは接続ユーザー名を検査しません。そのユーザーは共有テーブルの全列を読み書きできるので、`User.password` とパスキーの公開鍵材料も参加アプリから届きます。`app_participant` への列権限は使われません。同じ文字列を `app_participant` にすると、認証サーバーは共有テーブルを書き換えられないので動作しません。

## 順番

1. 認証サーバーを起動し、共有テーブルができるまで待つ。対象は `User`、`WebAuthnCredential`、`App`、`AppGrant` です。
2. 参加アプリを初めて起動するより前に、ロール、参照権限、そのアプリのスキーマを用意する。
3. 参加アプリの `DATABASE_URL` を `app_participant` にする。
4. 参加アプリを起動する。起動時の `prisma migrate deploy` が、そのスキーマの型とテーブルを作る。

Coolify のデプロイはコンテナの起動を含むので、手順 2 は参加アプリの初回デプロイより前です。

## コマンド

参加アプリのリポジトリで、データベースへ届くマシンから実行します。参加アプリは起動していなくてよいです。

`ADMIN_DATABASE_URL` は、認証サーバーと同じ読み書きできる接続文字列です。`DATABASE_URL` は `app_participant` です。データベース名が違うとき、`DATABASE_URL` のユーザーが `app_participant` でないとき、`ADMIN_DATABASE_URL` のユーザーが `app_participant` のときは、中止します。

```bash
pnpm db:init
```

このコマンドは次を行います。

- ロール `app_participant` が無ければ作る。パスワードは `DATABASE_URL` のものです。既にあるときはパスワードを変えません。
- 実行中のユーザーを `app_participant` のメンバーにし、スキーマの所有者をそのロールにできるようにする。
- 共有テーブルへの参照権限を付与する。`User` は `id`、`email`、`name`、`role`、`disabledAt`。`WebAuthnCredential` は `id`、`userId`。`App` と `AppGrant` は全列の `SELECT` です。`User.password`、パスキーの公開鍵、カウンタ、`credentialId`、`transports` は付与しません。
- そのアプリのスキーマを作り、所有者を `app_participant` にする。ロール見本のスキーマは `roles` です。

ロールは全参加アプリで1つです。アプリを増やすたびに作りません。スキーマはアプリごとに作ります。同じコマンドは何度実行しても同じ結果になります。起動処理では呼びません。

## 手入力

`pnpm db:init` を実行できないときは、読み書きできる管理者で同じ内容を実行します。参加アプリの初回デプロイ前で、手元からデータベースへ届かない場合がこれにあたります。`replace-me` は `app_participant` のパスワード、`your_database` は認証サーバーと同じデータベース名です。スキーマ名はアプリごとに置き換えます。ロール見本は `roles` です。

ロールが既にあるときは `CREATE ROLE` だけを飛ばし、パスワードは変えません。残りの文は、そのまま再実行できます。

```sql
CREATE ROLE app_participant LOGIN PASSWORD 'replace-me';
GRANT app_participant TO CURRENT_USER;
GRANT CONNECT ON DATABASE your_database TO app_participant;
GRANT USAGE ON SCHEMA public TO app_participant;
GRANT SELECT (id, email, name, role, "disabledAt") ON TABLE "User" TO app_participant;
GRANT SELECT (id, "userId") ON TABLE "WebAuthnCredential" TO app_participant;
GRANT SELECT ON TABLE "App", "AppGrant" TO app_participant;
CREATE SCHEMA IF NOT EXISTS roles AUTHORIZATION app_participant;
ALTER SCHEMA roles OWNER TO app_participant;
```

## 参加アプリの起動

スキーマの所有者は `app_participant` です。その中の型、テーブル、マイグレーション履歴は、参加アプリの接続で作ります。履歴テーブルは、そのアプリのスキーマに置きます。`public` には書きません。

マイグレーションはコンテナの起動時に適用します。適用済みなら何もしません。失敗したらプロセスを終了し、サーバーは待ち受けません。ビルド時には適用しません。

スキーマが無い状態で起動すると、マイグレーションは失敗してプロセスが終了します。そのあとでコマンドか手入力を実行し、参加アプリを再起動します。起動を失敗させることは、正規の手順にしません。

ロール見本で、既に古いマイグレーションを適用したローカルデータベースがあるときは、スキーマ `roles` だけを削除してから参加アプリを起動し直します。`public` の共有テーブルには触れません。
