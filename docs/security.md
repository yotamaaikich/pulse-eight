# セキュリティ対策

2026-11-01 / v1.6.0

- Google認証はPKCEを使用。Windowsアプリは標準ブラウザで認証し、固定のコールバックだけを受け付ける。
- Windowsの認証情報はElectron safeStorageの非同期APIとDPAPIで暗号化。旧保存形式からの移行は保存成功後に旧データを削除する。暗号化できない環境では平文ファイルへ保存せず、起動中のメモリだけを使う。
- IPCの送信元はゲームのメインフレームに限定。認証保存のキー・値の長さ・件数を制限し、任意のパスやファイルを扱わない。
- CSPでスクリプトを同梱ファイルとYouTube公式APIに限定。インラインスクリプト、eval、プラグインを禁止。ランキング名はHTMLとして扱わない。保存済みキー配置も許可したキー名だけを使う。
- nodeIntegrationを無効、sandbox・contextIsolation・webSecurityを有効。配布EXEはRunAsNode、NODE_OPTIONS、デバッガー起動、fileプロトコルの追加権限を無効化。ASARの整合性検証とASAR限定起動を有効化する。
- DBはRLSと権限剥奪に加え、一般ユーザーを明示的に拒否するポリシーを使用。スコア保存と制限用RPCはサーバーロールだけが呼び出せる。
- APIは認証済みIDをAuthサーバーへ確認し、開始券の所有者を照合。スコアは入力記録からサーバーで再計算し、二重登録を拒否する。
- API要求は接続元の補助的な識別値、確認済みアカウント、全体の上限をDBでまとめて数える。並列インスタンスでも上限を共有する。接続元ヘッダーが偽装されても全体上限は外せない。読み込みは接続元120/分・全体1200/分、書き込みは接続元30/分・全体240/分、アカウントは60/分。通常のリトライ制限は別途維持する。
- 接続元の制限キーはサーバー秘密値によるHMACを日ごとに変更し、生IPを制限テーブルに保存しない。2時間経過したカウンターは順次削除する。更新は行ロックと条件付きupsert、期限切れの削除はSKIP LOCKEDを使う。
- 本文は読み込み中に512,000バイトで打ち切り、読み込み待ちも8秒までに制限する。JSON形式・経路・メソッドも検証する。
- ビルド依存を更新し、npm auditで既知の脆弱性0件を確認。CIで全依存の監査、秘密情報パターンの検査、テスト、EXEのFuse設定、OS暗号化、起動を確認する。GitHub ActionsはコミットSHAで固定する。
- 配布EXE/ZIPにはSHA-256とGitHubのビルド来歴証明を添付する。確認例は `gh attestation verify <ファイル名> --repo yotamaaikich/pulse-eight`。

## 制約

正式なWindows Authenticode証明書は未設定。GitHubの来歴証明はWindowsの発行元署名とは別の仕組みで、SmartScreenの警告を消すものではない。

ブラウザ版のセッション保存はブラウザの保護に従う。DPAPIも同じWindowsユーザーとして動くマルウェアからの保護は保証しない。GitHub Pagesの他の同一オリジンのサイトの安全性も必要になる。完全な自動プレイ検出や、大規模なDDoSに耐える保証はしない。

Supabaseの漏洩パスワード保護の警告はメール・パスワード認証向け。ゲームはGoogle認証を使い、他のアプリとも共用しているプロジェクト全体の認証方式は変更していない。

## APIの再デプロイ

`node scripts/cloud-bundle.mjs cloud-bundle.json` で相対依存を集め、ブラウザ用のバージョンクエリを除いたソースを生成する。`cloud/security.sql` は適用済みのDB定義。配備時のサーバー秘密値はSupabaseの環境変数に置く。

## 参考

- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electronjs.org/docs/latest/api/safe-storage
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/auth/password-security
- https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations
