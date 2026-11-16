# パスキー署名検証とクレデンシャル ID のレビュー（2026-11-16）

**日付**: 2026-11-16  
**対象**: パスキーの署名検証、クレデンシャル ID の一意性、削除の所有者確認  
**観点**: `planning/test-sample.md`（署名未検証によるなりすまし、クレデンシャル ID の重複による公開鍵の上書き・パスキーの削除・アカウントのすり替え）  
**方法**: ソースコードとスキーマの静的レビュー  
**変更**: このレビューでは実装変更を行っていない

## 概要

`planning/test-sample.md` の2点について、パスキーの登録、ログイン、再認証、削除を確認した。この実装では、いずれも成立しない。

| # | 検証ポイント | 結果 |
|---|---|---|
| 1 | 暗号署名を検証せず、改ざんしたアサーションで他人のアカウントにログインできる | 成立しない |
| 2 | 被害者のクレデンシャル ID を攻撃者のアカウントへ登録し、公開鍵を上書きしてログイン不能にする | 成立しない |
| 3 | 被害者のクレデンシャル ID を使ってパスキーを削除する | 成立しない |
| 4 | 被害者の公開鍵も入手し、被害者を攻撃者のアカウントへログインさせる | 成立しない |

## 検証ポイント

### 1. 暗号署名の検証

ログイン、再認証、登録は `@simplewebauthn/server` の検証結果だけを採用する。

- ログインの `verifyAuthentication`（`src/server/auth/webauthn.ts`）は、DB の `publicKey` と `counter` を `verifyAuthenticationResponse` に渡す。`verification.verified` が真のときだけカウンタを更新し、`credential.userId` を返す。`POST /login/passkey/verify`（`src/server/api/routes/auth.ts`）はそのユーザーにセッションを発行する。
- 再認証の `verifyScopedReauth` は同じ検証に加え、`credential.userId` がセッションのユーザーと一致することを要求する。
- 登録の `verifyRegistration` は `verifyRegistrationResponse` の `registrationInfo.credential` から `credentialId` と `publicKey` を保存する。クライアントが送った ID や公開鍵をそのままは保存しない。

ログインでは、チャレンジを選ぶために `clientDataJSON` から文字列を先に読む。その後の `verifyAuthenticationResponse` が、選んだチャレンジ、期待する Origin、RP ID、保存済み公開鍵に対する署名を検証する。改ざんした `clientDataJSON` や `authenticatorData` はこの検証で拒否される。

### 2. 公開鍵の上書き

被害者のクレデンシャル ID は、ログイン開始時の `allowCredentials` に含まれる。メールアドレスを知る相手には見える。登録時の `excludeCredentials` は操作中のユーザーの鍵だけを並べる。他ユーザーとの重複拒否は、認証器ではなくデータベースの一意制約が担う。

- `prisma/schema.prisma` の `WebAuthnCredential.credentialId` は `@unique` である。初期マイグレーション `prisma/migrations/20261015191900_init/migration.sql` に `WebAuthnCredential_credentialId_key` がある。
- 保存は `src/server/db/credential.ts` の `create` のみである。`upsert` はなく、既存行の `userId` と `publicKey` を書き換える処理もない。更新は `counter` と `lastUsedAt` だけである。
- 一意制約違反は登録 API の失敗になり、既存の被害者レコードは残る。

### 3. パスキーの削除

`DELETE /devices/:id`（`src/server/api/routes/devices.ts`）は、セッションの `user.id` と行の UUID の両方で `deleteForUser` する。一覧が返す `id` は行の UUID であり、クレデンシャル ID ではない。他ユーザーの行を消す拒否は `src/server/api/devices.integration.test.ts` にある。

### 4. アカウントのすり替え

同じクレデンシャル ID を攻撃者の `userId` で保存する経路はない。ログインは、署名検証に通った行の `userId` にセッションを発行する。公開鍵を入手しても、被害者の認証器による署名が攻撃者のアカウントへの入場になる経路はない。

## 結論

この実装では、次は成立しない。

- 署名を検証せず、改ざんしたアサーションで他人のアカウントにログインする
- 被害者のクレデンシャル ID を攻撃者のアカウントへ登録し、公開鍵を上書きする、パスキーを削除する、または被害者を攻撃者のアカウントへログインさせる

## 確認範囲・制約

本レビューはソースとスキーマの静的確認である。攻撃の再現はしていない。`@simplewebauthn/server` の検証関数が署名を検証することは、呼び出し側が保存済み公開鍵を渡し `verified` を確認していることから見ている。ライブラリ内部の実装そのものはこのレビューでは読んでいない。
