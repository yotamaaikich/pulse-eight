セキュリティを強化したWindows版です。

- 認証情報をWindowsの暗号化機能で保存。旧形式は移行後に削除
- CSP、危険な起動機能の無効化、ASARの整合性検証を追加
- APIの全体・接続元・アカウント別アクセス制限と、送信サイズ・待ち時間の制限を追加
- ビルド依存を更新し、既知の脆弱性0件を確認
- GitHubのビルド来歴証明とSHA-256を添付

114件のテスト、保護設定を有効にしたEXEの起動、OS暗号化の往復検証、本番APIの拒否テストを実施しています。

PIANO-PULSE-Setup-1.6.0.exe はインストーラー、PIANO-PULSE-1.6.0-x64.zip は展開して「PIANO PULSE.exe」を起動します。

正式なWindowsの発行元署名は未設定です。GitHubの来歴証明はSmartScreen警告を消す仕組みではありません。音楽・動画・オンライン機能には接続が必要で、YouTube広告が入る場合があります。

[遊び方](https://github.com/yotamaaikich/pulse-eight#遊び方) · [セキュリティの詳細](https://github.com/yotamaaikich/pulse-eight/blob/main/docs/security.md) · [ブラウザ版](https://yotamaaikich.github.io/pulse-eight/)
