# 参加アプリ連携 整合性レビュー（2026-11-09）

**日付**: 2026-11-09
**対象**: auth-server、participant-app-base、sample-app の引き渡し・入場まわりのドキュメントと実装
**方法**: ソースコードとドキュメントの静的レビュー
**変更**: このレビューでは実装変更を行っていない

## 概要

3リポジトリの `main` を照合し、認証・引き渡し・入場・全体ログアウトを壊す実装間の不整合は確認しなかった。ドキュメントと実装のずれとして、以下を確認した。

| # | 重大度 | 箇所 | 問題 | 確信度 |
|---|---|---|---|---:|
| 1 | 低 | `auth-server/docs/participant-integration.md`、`sample-app/astro.config.mjs`、`participant-app-base/src/middleware/access.ts` | 連携確認手順は未ログインで参加アプリの `/` を開くと引き渡しが始まると書いているが、sample-app は `/` を公開パスにしており、確認の入口は `/admin` である | 9/10 |
| 2 | 低 | `auth-server/planning/participant-app.md`、`auth-server/src/server/auth/app-host.ts`、`auth-server/src/server/auth/app-registration.ts` | 企画メモは `GET /callback?code=&state=` を `App.redirectUris` に登録するように読めるが、実装は `?` や `#` 付き URL を拒否する | 9/10 |

上記はコードから確認できるドキュメントのずれである。実サーバーの起動、ブラウザ操作、テスト実行はしていない。`APP_ID`、`APP_ORIGIN`、登録済みの戻り先、同じ DB / Redis、同じ `REDIS_KEY_PREFIX` が揃っているかは未確認である。

## 指摘事項

### 1. 認証側の統合確認手順が、sample-app の公開トップページに未追従

認証側の参加アプリ連携手順は、未ログインで参加アプリの `/` を開くと引き渡しが始まると書いている。

しかし sample-app は `publicPaths: ['/']` を指定しており、基盤の middleware はそのパスでセッション解決や引き渡しを行わない。sample-app で引き渡しを確認する入口は `/admin` である。

そのため、正常な公開トップページの動作を、認証連携の故障と誤認するおそれがある。

**推奨対応**

- sample-app を使う確認手順では、入口を `/admin` にする。
- 公開トップでは引き渡しを開始しないことを、手順側にも明記する。

根拠:

- [docs/participant-integration.md](https://github.com/npomori/auth-server/blob/main/docs/participant-integration.md)
- [astro.config.mjs](https://github.com/npomori/sample-app/blob/main/astro.config.mjs)
- [src/middleware/access.ts](https://github.com/npomori/participant-app-base/blob/main/src/middleware/access.ts)
- [README.md](https://github.com/npomori/sample-app/blob/main/README.md)

### 2. コールバックの「登録 URL」と「実際のアクセス URL」の記述が混同

認証側の企画メモ「5. コールバック」には、`GET /callback?code=&state=` を `App.redirectUris` に登録すると読める記述がある。

実装では、登録 URL に `?` または `#` があると拒否する。正しい登録値は `{APP_ORIGIN}/callback` で、`code` と `state` は引き渡し時に認証側が付加する。participant-app-base 側の実装はこの形式である。

仕様文を文字どおり設定に使うと、戻り先 URL の登録が失敗する。

**推奨対応**

- 登録する絶対 URL と、受信時のクエリ付き URL を分けて説明する。
- 登録例は `{APP_ORIGIN}/callback` とし、`code` と `state` は認証側が付加することを明記する。

根拠:

- [planning/participant-app.md](https://github.com/npomori/auth-server/blob/main/planning/participant-app.md)
- [src/server/auth/app-host.ts](https://github.com/npomori/auth-server/blob/main/src/server/auth/app-host.ts)
- [src/server/auth/app-registration.ts](https://github.com/npomori/auth-server/blob/main/src/server/auth/app-registration.ts)
- [src/server/env.ts](https://github.com/npomori/participant-app-base/blob/main/src/server/env.ts)

## 確認範囲・制約

本レビューはソースとドキュメントの静的確認であり、稼働中の環境、登録データ、ACL、デプロイ済み環境変数は検証していない。脆弱性の再現試験も実施していない。
