# データベースの初期化

この手順は、認証サーバーと参加アプリで共通です。参加アプリ側の同じ文書は、ロール見本の `docs/db-init.md` です。同じ PostgreSQL を使い、接続ユーザーは分けます。

## 接続

| 側 | 接続 | 起動時にすること |
| --- | --- | --- |
| 認証サーバー | 読み書きできるユーザー | `public` の共有テーブルをマイグレーションする |
| 参加アプリ | `app_participant` | そのアプリのスキーマにある未適用のマイグレーションだけを適用する |

認証サーバーの起動処理は、ロール `app_participant` もスキーマも作りません。参加アプリの起動処理も作りません。管理者の接続文字列は、参加アプリの本番環境変数に置きません。

読み書きできる接続文字列を参加アプリにも置くと、画面の参照とそのアプリのマイグレーションは動作します。アプリは接続ユーザー名を検査しません。そのユーザーは共有テーブルの全列を読み書きできるので、`User.password` とパスキーの公開鍵材料も参加アプリから届きます。`app_participant` への列権限は使われません。同じ文字列を `app_participant` にすると、認証サーバーは共有テーブルを書き換えられないので動作しません。

## 順番

1. 認証サーバーを起動し、共有テーブルができるまで待つ。対象は `User`、`WebAuthnCredential`、`App`、`AppGrant` です。
2. 認証サーバーのデータベースで、下の SQL を一度実行する。
3. 参加アプリの `DATABASE_URL` を `app_participant` にする。
4. 参加アプリを起動する。起動時の `prisma migrate deploy` が、そのスキーマの型とテーブルを作る。

Coolify では、手順 2 を認証サーバーが使っている PostgreSQL の画面で実行します。参加アプリの初回デプロイより前です。

## 手作業

共有テーブルができたあと、読み書きできるユーザーで実行します。`replace-me` は参加アプリの `DATABASE_URL` に書くパスワードです。`your_database` は認証サーバーと同じデータベース名です。ロール見本のスキーマは `roles` です。別の参加アプリでは、スキーマ名だけをそのアプリのものに置き換えます。

ロール `app_participant` は全参加アプリで1つです。アプリを増やすたびに作りません。ロールが既にあるときは `CREATE ROLE` だけを飛ばし、パスワードは変えません。残りの文は、そのまま再実行できます。

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

付与するのは次だけです。`User` は `id`、`email`、`name`、`role`、`disabledAt`。`WebAuthnCredential` は `id`、`userId`。`App` と `AppGrant` は全列の `SELECT` です。`User.password`、パスキーの公開鍵、カウンタ、`credentialId`、`transports` は付与しません。

`GRANT app_participant TO CURRENT_USER` は、実行中のユーザーがスキーマの所有者を `app_participant` にできるようにするためです。

## 参加アプリの起動

スキーマの所有者は `app_participant` です。その中の型とテーブルは、参加アプリの接続で作ります。`public` の共有テーブルには書きません。

マイグレーションの前に、接続ユーザーが `app_participant` であること、スキーマ `roles` がありそのユーザーがテーブルを作れること、失敗したマイグレーション記録が無いことを確認します。満たさないときはマイグレーションを始めずにプロセスを終了します。満たすときはコンテナの起動時に適用します。そのときだけ接続の `schema` を `roles` にし、履歴テーブルを `roles."_prisma_migrations"` に作ります。アプリの `DATABASE_URL` は `schema=public` のままです。適用済みなら何もしません。失敗したらプロセスを終了し、サーバーは待ち受けません。ビルド時には適用しません。

失敗した記録が `roles."_prisma_migrations"` に残っているときは、未完了の行を消してから参加アプリを起動します。`public."_prisma_migrations"` は認証サーバーの履歴なので消しません。

ロール見本で、既に古いマイグレーションを適用したローカルデータベースがあるときは、スキーマ `roles` だけを削除してから、上の SQL のスキーマ作成を実行し、参加アプリを起動し直します。`public` の共有テーブルには触れません。
