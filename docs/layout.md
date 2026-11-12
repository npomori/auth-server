# 基本デザインとレイアウト

認証骨格が描く画面の枠、部品、各ページの見た目は、このパッケージの Astro ファイルにあります。色やフォントの土台は参加アプリの CSS です。画面はソースのまま配布され、参加アプリのビルドがコンパイルします。

## 変更する場所

| 変えたいもの                               | ファイル                             |
| ------------------------------------------ | ------------------------------------ |
| ヘッダー、ナビ、本文の幅、ページ全体の地色 | `src/layouts/MainLayout.astro`       |
| ログアウトボタン                           | `src/components/LogoutForm.astro`    |
| 権限がないときの文言と戻りリンク           | `src/components/Denied.astro`        |
| 各画面の見出し、表、本文                   | `src/pages/` の該当ページ            |
| Tailwind のテーマ、フォント、リセット      | 参加アプリの `src/styles/global.css` |

このパッケージに CSS ファイルはありません。見た目の差分は、各要素の `class` に書いた Tailwind のユーティリティで表します。

## 共通レイアウト

`src/layouts/MainLayout.astro` が HTML の枠です。参加アプリの業務画面からも `participant-app-base/layout` として同じファイルを使います。

- `body` の `bg-gray-50 text-gray-900` がページ全体の地色と文字色です。
- `header` と `nav` が上部の帯、アプリ名、画面へのリンクです。
- ヘッダーの色は2つです。参加アプリの公開画面は、そのアプリのブランド色です。管理画面と認証サーバーは黒です。`bg-gray-800` のような黒の濃淡で、アプリや作業を分けません。
- 参加アプリの公開画面と `/logged-out` のヘッダーは `bg-brand text-white` です。`/logged-out` は参加アプリへ戻った画面で、表示名はそのアプリの `displayName` です。色の値は参加アプリの `src/styles/global.css` の `--color-brand` に1つ書きます。
- `/grants` と `/roles` のヘッダーは `bg-black text-white` です。管理画面は黒で共通です。認証サーバーの画面（ログイン、ログインできないとき、パスキー登録、権限がない、管理）のヘッダーも同じクラスにします。その変更は認証サーバーのリポジトリで行います。
- ヘッダーが黒のとき、どのアプリにいるかは `displayName` で示します。ログインか管理かは、中央のフォームか左のメニューかで分けます。ヘッダーの色では分けません。
- `main` の `mx-auto max-w-3xl px-4 py-10` が本文の幅と余白です。各ページの内容は `<slot />` に渡します。
- ヘッダーのアプリ名は integration の `displayName` です。画面にハードコーディングしません。下の例は公開画面のヘッダーです。

```astro
---
import 'virtual:participant-app-base/global.css'
import { displayName } from 'virtual:participant-app-base/config'
---

<body class="bg-gray-50 text-gray-900">
  <header class="border-b border-black/10 bg-brand text-white">
    <nav class="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
      <a class="text-lg font-semibold text-white" href="/">
        {displayName}
      </a>
    </nav>
  </header>
  <main class="mx-auto max-w-3xl px-4 py-10">
    <slot />
  </main>
</body>
```

```css
@theme {
  --color-brand: #166534;
}
```

参加アプリの業務画面は、ページごとにレイアウトを選びます。公開ページは `FrontLayout` でヘッダーを `bg-brand text-white` にします。管理ページは `AdminLayout` でヘッダーを `bg-black text-white` にします。認証サーバー自身の画面も、管理ページと同じ `bg-black text-white` です。幅やサイドバーは管理レイアウトに書きます。フロントの「ログイン」は、`publicPaths` に無い管理パス（例: `/admin`）へ向けます。このパッケージの `/logged-out` の「ログイン」は `/` です。

ヘッダーのリンクとログアウトは、`Astro.locals.access` で出し分けます。出し分けの書き方は [ページのアクセス制御と画面分岐](./page-access.md) に従います。ログアウトは `POST /logout` のフォームです。

参加アプリのページで同じヘッダーを使うときは、次のように読みます。

```astro
---
import Layout from 'participant-app-base/layout'
---

<Layout title="画面タイトル">
  <h1 class="text-2xl font-semibold">画面タイトル</h1>
</Layout>
```

## このパッケージの画面

共通レイアウトを使っている画面は次のとおりです。見出し、表、リンクのクラスは各ページに直接書いてあります。見出しは `text-2xl font-semibold`、リンクは `text-blue-700 underline` です。

| パス          | ファイル                     | 中身                 |
| ------------- | ---------------------------- | -------------------- |
| `/logged-out` | `src/pages/logged-out.astro` | ログアウト後の案内   |
| `/grants`     | `src/pages/grants.astro`     | 利用許可の例外の表   |
| `/roles`      | `src/pages/roles.astro`      | アプリ内ロールの案内 |

`src/pages/callback.astro` は HTML を描かず、引き渡しのあとリダイレクトします。ここにはレイアウトもスタイルもありません。

## 参加アプリの CSS

`MainLayout.astro` は `virtual:participant-app-base/global.css` を読みます。`src/integration.ts` は、これを参加アプリのプロジェクトルートにある `src/styles/global.css` に解決します。ファイルが存在しない場合はビルドを停止します。

Tailwind のテーマ、フォント、リセットを変えるときは、その CSS を変更します。ユーティリティクラスそのものを変えるときは、このパッケージの Astro ファイルを変更します。
