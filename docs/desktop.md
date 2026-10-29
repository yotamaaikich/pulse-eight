# Windowsアプリ・開発メモ

## 実装

Electronにゲーム・譜面・録音ピアノ・チュートリアル・認証ライブラリを同梱します。起動時のゲーム本体はインターネットからダウンロードしません。YouTubeとオンラインスコア・Googleログインは接続が必要です。

独自アプリ名・アイコン・AppUserModelID・インストーラー・アンインストーラーを使用します。Googleログインは標準ブラウザで行い、PKCEと`pianopulse://auth/callback`で戻ります。Googleアカウントのパスワードをアプリ内へ入力しません。

Rendererはsandbox・contextIsolation・webSecurityを有効、nodeIntegrationを無効にしています。preloadは固定のIPCだけ公開し、メインフレームとURLを確認します。公開サイトのHTTPSオリジンを保ったまま同梱ファイルを返し、YouTubeのRefererを維持します。他の通信は通常のChromiumのTLS検証を使います。

Discordは公式RPCのローカル名前付きパイプへ接続します。Application IDは公開情報です。Botトークン・Discordユーザートークンは使いません。状態更新は最低4.2秒の間隔へまとめ、Discord終了後は再接続します。

## ビルド

Node.js 24、Windows x64:

```sh
npm ci --ignore-scripts
node node_modules/esbuild/install.js
node node_modules/electron/install.js
npm test
npm run desktop:dev
npm run desktop:build
```

成果物は`dist/PIANO-PULSE-Setup-1.5.2.exe`と`dist/PIANO-PULSE-1.5.2-x64.zip`。GitHub Releaseの公開でWindowsビルドを実行し、テストが通った成果物とSHA-256を添付します。コード署名証明書は未設定です。

CIでは生成したEXEを`--smoke-test`で起動し、同梱Rendererがメインプロセスへ初回の状態を送れることも確認します。専用の一時データ領域を使い、Discordの表示・カスタムURLの登録・ゲームウィンドウの表示を行いません。これは起動検証であり、実動画や実際のDiscordプロフィール表示の検証とは別です。

## 認証設定

Supabase GoogleプロバイダのWeb OAuthクライアントはGoogle Cloudで作成します。GoogleのリダイレクトURIは`https://yowhxryuxsqvjddizrts.supabase.co/auth/v1/callback`。Client SecretはSupabaseの設定だけに保存し、Gitへ入れません。

Supabaseの許可リダイレクトは公開サイトと`pianopulse://auth/callback`です。スコアAPIはBearerをSupabase Authの`/user`で確認し、認証済みIDのハッシュでスコアを分離します。未認証は従来のゲスト識別子を使います。ゲストの記録を無断で移しません。既存の不要な創作譜面のDBテーブルはデータ保全のため削除していません。

## タッチ

Pointer Eventsとpointer captureを使用します。複数の指・キーボードを混ぜた長押しは最後の入力元が離れるまで継続します。ペダルはHARDだけ、44pxの押せる範囲と32pxの下部余白。通常の長押しとFLOATのSpace状態は独立しています。
