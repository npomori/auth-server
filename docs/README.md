# ドキュメント

最初に読む資料は [../AGENTS.md](../AGENTS.md) です。この表は確定資料だけです。

| ファイル                                                   | 内容                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| [specification.md](./specification.md)                     | 本アプリの確定仕様（認証・権限・API・環境変数）                             |
| [session-management.md](./session-management.md)           | セッション管理の詳細仕様                                                    |
| [redis.md](./redis.md)                                     | Redis キー設計・TTL・環境変数・障害時の挙動                                 |
| [testing.md](./testing.md)                                 | テスト方法（`pnpm test` / `pnpm test:integration`・静的チェック・手動検証） |
| [participant-integration.md](./participant-integration.md) | 認証サーバーと別プロジェクトの参加アプリをローカルで同時に動かす統合テスト  |
| [db-init.md](./db-init.md)                                 | 認証サーバーと参加アプリで共通のデータベース初期化                          |
| [layout.md](./layout.md)                                   | 共通の色と、入口・管理の大まかな枠                                          |

下書きは `planning/` にあります。資料が矛盾したときの優先順位は [../AGENTS.md](../AGENTS.md) に従います。

## セキュリティの検証記録

`docs/reviews/` にある記録のうち、認証の安全性を確認したものです。確定仕様ではありません。

| 記録 | 日付 | 観点 |
| --- | --- | --- |
| [reviews/2026-11-16-passkey-credential-id-review.md](./reviews/2026-11-16-passkey-credential-id-review.md) | 2026-11-16 | パスキーの署名検証、クレデンシャル ID の一意性、削除の所有者確認、アカウントのすり替え |
| [reviews/2026-10-17-auth-security-review.md](./reviews/2026-10-17-auth-security-review.md) | 2026-10-17 | 認証メールの漏えい、ワンタイムトークンの重複使用、レート制限、Origin と RP ID |
| [reviews/2026-10-28-session-index-ttl.md](./reviews/2026-10-28-session-index-ttl.md) | 2026-10-28 | セッション失効後も参加アプリへ入場できる索引の残り |
| [reviews/2026-08-10-implementation-review.md](./reviews/2026-08-10-implementation-review.md) | 2026-08-10 | 仕様との整合に加え、レート制限、WebAuthn チャレンジ、パスワード再設定の通知、RP ID |

次の記録はセキュリティ検証ではありません。

| 記録 | 日付 | 内容 |
| --- | --- | --- |
| [reviews/2026-11-09-consistency-review.md](./reviews/2026-11-09-consistency-review.md) | 2026-11-09 | 参加アプリ連携のドキュメントと実装のずれ |
| [reviews/2026-08-14-better-auth-comparison.md](./reviews/2026-08-14-better-auth-comparison.md) | 2026-08-14 | Better Auth との設計比較 |
| [reviews/2026-08-10-testing-recommendations.md](./reviews/2026-08-10-testing-recommendations.md) | 2026-08-10 | テストの不足 |
