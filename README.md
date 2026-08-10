# Parks — コインパーキングまとめサイト (MVP)

公式サイトから収集したデータとユーザーからの報告を組み合わせて、近くのコインパーキングを
**位置・料金・空き状況** で探せるサービスです。自車のサイズを入力すると、実際に停められる
駐車場だけに絞り込めます。

## クイックスタート

```bash
npm install
npm run dev      # http://localhost:3000
```

**環境変数なしでそのまま動きます。** `DATABASE_URL` が未設定のときはプロセス内 Postgres
（PGlite）が起動し、渋谷周辺のデモデータが自動で投入されます。Google Maps のキーが無ければ
地図の代わりにリスト表示になり、Clerk のキーが無ければ閲覧専用モードになります。

本番相当の構成にするには `.env.example` を `.env.local` にコピーして値を埋めてください。

## MVP でできること

| 機能 | 実装 |
| --- | --- |
| 地図上に駐車場を表示 | Google Maps (Advanced Markers)。空車/混雑/満車でピンを色分け |
| 料金の表示 | 時間帯別料金・打ち切り最大料金を含む見積り計算 (`src/domain/pricing.ts`) |
| 空き情報 | 公式データとユーザー報告を時間減衰つきで統合 (`src/domain/availability.ts`) |
| 自車でフィルタ | 全長・全幅・全高・重量・タイヤ幅で絞り込み。未公表の制限は「要確認」と明示 |
| ユーザー報告 | Clerk でサインインしたユーザーが空車状況を投稿 |
| データ収集 | 公式サイト向けアダプタ + 正規化パイプライン (`src/ingest/`)、Vercel Cron で定期実行 |

## 構成

提案どおり Vercel + React + Clerk + Google Maps を採用し、以下を追加しています。

- **Next.js (App Router)** — Vercel 上で React を動かす標準構成。API Routes を同じリポジトリに
  置けるので、データ収集エンドポイントとフロントを一体で扱えます。
- **Neon Postgres + Drizzle ORM** — Vercel から使えるサーバーレス Postgres。位置検索は
  バウンディングボックスで絞ってから正確な距離を計算します（PostGIS は MVP では不要）。
- **PGlite** — 開発・テスト・デモ用のプロセス内 Postgres。CI にデータベースサービスが要らず、
  本番と同じ SQL をそのまま検証できます。
- **Vitest + Testing Library** — テストカバレッジ 100%（しきい値を CI で強制）。

```
src/
  domain/      料金計算・空き状況の統合・車両適合判定（純粋関数、副作用なし）
  db/          Drizzle スキーマ、マイグレーション、リポジトリ
  ingest/      公式サイトからの取り込みアダプタと正規化
  app/api/     REST エンドポイント
  components/  地図・検索結果・詳細・報告フォーム
  hooks/       検索と詳細のデータ取得
  lib/         クエリ解析・整形・APIクライアント
```

### データモデルの要点

- **料金** は「時間帯ごとの単価」＋「打ち切り最大料金」で表現します。最大料金は
  `daily`（暦日ごとにリセット）と `once`（入庫時刻からの一定時間）を区別できます。
  滞在をセグメント単位のブロックに切り、日をまたいでもメーターを継続させて課金します。
- **空き状況** は公式データとユーザー報告を指数減衰で重み付けし、多数決で決定します。
  5分前のユーザー報告は1時間前の公式データより重くなります。確度も併せて返します。
- **車両制限** は「未公表」と「制限なし」を区別します。未公表の項目がある駐車場は除外せず、
  「要確認」として表示します。

## API

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/api/parkings` | 不要 | 位置・半径・車両サイズ・種別で検索 |
| GET | `/api/parkings/:id` | 不要 | 詳細、料金内訳、報告履歴 |
| GET | `/api/parkings/:id/reports` | 不要 | 報告履歴 |
| POST | `/api/parkings/:id/reports` | 必要 | 空き状況を報告 |
| GET / PUT | `/api/vehicle-profile` | 必要 | 自車情報の保存 |
| GET | `/api/cron/ingest` | Cron Secret | 公式サイトからの取り込み |
| GET | `/api/health` | 不要 | 死活監視 |

検索の例:

```
/api/parkings?lat=35.658&lng=139.7016&radius=800&preset=van&duration=180&hideFull=1
```

## データ収集

`INGEST_SOURCES` に JSON 配列でフィードを登録します。

```json
[{ "source": "operator-a", "label": "オペレーターA", "endpoint": "https://example.com/feed.json" }]
```

正規化層は `2.1m` / `210cm` / `2100mm`、`機械式` / `平面`、`満車` / `空車` といった実際の表記ゆれを
吸収します。HTML しか公開していない事業者は `IngestAdapter` を実装し、同じ生レコード形式を
返すだけで組み込めます（`src/ingest/adapters/http-json.ts` が実装例）。

`vercel.json` の cron で10分ごとに `/api/cron/ingest` を叩きます。`CRON_SECRET` が未設定の間は
エンドポイントは 503 を返して無効のままです。

> 収集対象を追加する際は、各サイトの利用規約と robots.txt を確認してください。

## スクリプト

```bash
npm run dev             # 開発サーバー
npm run build           # 本番ビルド
npm run lint            # ESLint
npm run typecheck       # tsc --noEmit
npm test                # Vitest
npm run test:coverage   # カバレッジ（100% を下回ると失敗）
npm run db:migrate      # 本番DBへマイグレーション
npm run db:seed         # マイグレーション + デモデータ投入
npm run ingest          # 取り込みを手動実行
```

## テスト

410 件のテストで、ステートメント・ブランチ・関数・行すべて 100% です。しきい値は
`vitest.config.ts` に設定してあり、CI で強制されます。

- ドメインロジック（料金・空き状況・適合判定・距離）は純粋関数として単体テスト
- リポジトリと API ルートは PGlite 上の**実際の Postgres** に対してテスト
- コンポーネントは Testing Library。Google Maps と Clerk はモック

カバレッジ対象外はルートレイアウト、Clerk のミドルウェア、CLI エントリポイントだけです
（いずれも分岐を持たないフレームワークの接続部分）。

## CI / デプロイ

- `.github/workflows/ci.yml` — lint・typecheck・カバレッジ付きテスト・ビルドを
  push と PR で実行します。テストは PGlite を使うのでデータベースサービスは不要です。
- `.github/workflows/deploy.yml` — `main` への push で本番、PR でプレビューを Vercel に
  デプロイし、`/api/health` でスモークテストします。本番デプロイ時のみマイグレーションを
  適用します（プレビューが本番DBを触ることはありません）。

  **プレビューデプロイはマージ条件です。** シークレットが未設定でデプロイできない場合は
  スキップせず失敗します。設定不足を緑で見逃さないためです。fork からの PR は
  シークレットを読めないため、このジョブは失敗します。

必要なリポジトリシークレット:

| シークレット | 必須 | 用途 |
| --- | --- | --- |
| `VERCEL_TOKEN` | 常に | Vercel CLI の認証。未設定ならジョブは失敗します |
| `VERCEL_ORG_ID` | 常に | 同上 |
| `VERCEL_PROJECT_ID` | 常に | 同上 |
| `DATABASE_URL` | 本番のみ | デプロイ前のマイグレーション。`main` への push で未設定なら失敗します |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | 推奨 | Deployment Protection 有効時、プレビューのスモークテストが 401 にならないようにします |

プレビュー環境で `DATABASE_URL` が未設定の場合はデプロイ自体は成功しますが、デモモード
（プロセス内 Postgres）で動作している旨を警告として出します。

Dependabot は npm と GitHub Actions を **毎日** 監視します（`.github/dependabot.yml`）。
関連パッケージはグループ化して、まとめて更新されるようにしています。

## 本番セットアップ

1. **データベース** — Vercel Postgres / Neon でプロジェクトを作成し、`DATABASE_URL` を設定して
   `npm run db:migrate` を実行します。
2. **Clerk** — アプリケーションを作成し、`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` と
   `CLERK_SECRET_KEY` を設定します。誰でもサインアップできる設定にしてください。
3. **Google Maps** — 用意済みの GCP プロジェクトで Maps JavaScript API を有効化し、API キーを
   HTTP リファラーで制限したうえで `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` に設定します。
   Advanced Markers 用の Map ID を作成して `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` に設定します。
4. **取り込み** — `CRON_SECRET` と `INGEST_SOURCES` を設定します。

## MVP の割り切りと次の一手

- 料金計算はセグメント単位で切り上げます。実際の事業者はメーターを跨いで通算する場合があり、
  数十円の差が出ることがあります。表示は「目安」です。
- ユーザー報告に不正対策（レート制限・信頼度スコア）はまだありません。
- 検索はバウンディングボックス + 正確な距離計算です。件数が増えたら PostGIS か
  Geohash インデックスへの移行を推奨します。
- 自車情報は保存 API を用意していますが、UI からの読み書きは未接続です。
