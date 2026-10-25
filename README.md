# PIANO PULSE

ボカロ・まどマギ・osu!定番・太鼓の達人収録曲の35曲を、白鍵8つで演奏するブラウザ音ゲー。
※現在ある譜面の創作にはcodexが使われています。

**プレイ： https://yotamaaikich.github.io/pulse-eight/**

## 操作

| キー | 操作 |
| --- | --- |
| A S D F / J K L ; | 白鍵8つ（左から順） |
| ↑ ↓ | 選曲 |
| ← → | EASY / NORMAL / HARD |
| Enter | 開始・再開・リトライ |
| Esc | 一時停止、停止中・結果画面から選曲へ |
| Shift+R | リトライ（HARDのプレイ中はRがフリック用） |
| V | 譜面と鍵盤だけを全画面表示 / 解除 |
| Shift+O | 設定（HARDのプレイ中はOがフリック用） |
| Space | HARDフリック。押したままレーンキーを移動できます |
| S（結果画面） | スコア登録 |

設定・選曲・名前変更などはTabで移動し、Enterで操作できます。キー配置は設定画面で変更できます。

## ゲーム

- 奥から手前に迫る8レーン。レーン、ノーツ、長押しの帯は同じ遠近投影を使用。ノーツとピアノ鍵盤には対応キー名を表示。白いレーン補助線と中央の境界線、左手・右手の表示で操作範囲を区別します。同時押しも通常と同じ左右の色で、白い横線で結びます。
- 単押し・長押し・同時押しに対応。NORMALから2鍵、HARDでは3鍵の同時押しも出現します。長押しは終端まで保持し、早く離すとMISS。長押し中の別キー入力にも対応します。
- HARD限定フリックはレーンキーを押したまま220ms以内にSpaceを押します。Spaceを先に押し続け、ノーツに合わせてレーンキーを押しても成功します。黄緑色の上向きAIR矢印で表示し、連続するAIRノーツを黄緑色の帯でつなぎます。帯に沿ってSpaceを押したままレーンを移動できます。Spaceだけでは取れず、通常の長押しはSpaceを離しても継続します。EASY・NORMALにはフリックは出現しません。上段8キーの操作は撤去しました。
- Escで一時停止したまま選曲・難易度変更ができます。左右の選択ボタン、矢印キー、または一時停止画面の「曲・難易度を変更」を使用します。「今のプレイがリセットされます」の確認で確定するとスコア・コンボ・進行時間をリセットします。キャンセルではそのまま再開できます。全画面でも変更ダイアログを使用できます。
- 全画面は譜面エリアだけを表示し、スコア・現在のコンボ・達成率も譜面内に表示します。右上の戻るボタンまたはVで解除できます。
- 白鍵は手動、黒鍵は自動の補助。黒鍵には文字ラベルを表示せず、得点にも含めません。
- 全曲フル尺（2:01〜5:50）。公式YouTubeプレイヤーの再生位置と同期し、バッファリング・一時停止中は譜面も止まります。
- 判定：PERFECT ±45ms / GREAT ±90ms / GOOD ±140ms / BAD ±170ms。
- スコアは100万点満点。端末の自己ベストと、曲・難易度・譜面バージョンごとの世界TOP10。
- ノーツ速度、動画音量、鍵盤音量、判定オフセット、キー配置を端末に保存。動画は初期50%、鍵盤は初期30%。以前の動画音量は初回のみ約70%へ下げ、0%は維持します。鍵盤音はWeb Audioで合成した柔らかい音で、読み込み・一時停止中には鳴りません。

## 曲別のピアノ音

演奏中はキー固定のドレミではなく、対象ノーツに割り当てた音程で発音します。35曲それぞれの既存の簡略フレーズを音程データとして使い、同時押しには低音を重ねます。鍵盤の幅と音域は独立し、同じキーでも曲の進行に応じて音程が変わります。空打ちでは旋律を先へ進めません。選曲画面・チュートリアルは固定の音階で練習できます。

最初の10曲は既存の半音フレーズ、追加25曲は既存の8鍵リズムアレンジの輪郭を使用しています。追加曲のフレーズは原曲の旋律・調性を採譜したものではなく、原曲と全音程が一致する演奏には未対応です。

譜面作成ボタンとエディタは撤去しました。「みんなの譜面」のボタン・一覧も撤去しました。既存のサーバーデータは削除せず保持しています。

## 収録曲と参照

当初のボカロ10曲の選曲元：[Billboard JAPAN「ニコニコ VOCALOID SONGS」2025年年間TOP10](https://www.hanshin.co.jp/press/docs/20251205_billboard%20japan2025.pdf#page=16)。最新週間チャートではありません。

| 曲 | 作者 | 主な参照 |
| --- | --- | --- |
| モニタリング | DECO*27 | [公開音名採譜](https://www.gyename.com/2024/12/deco27-monitoring.html) |
| テトリス | 柊マグネタイト | [公開音名採譜](https://www.gyename.com/2024/12/hiiragi-magnetite-tetoris.html) |
| メズマライザー | サツキ | [公開音名採譜](https://www.gyename.com/2024/10/satsuki-mesmerizer.html) |
| オーバーライド | 吉田夜世 | [公開音名採譜](https://www.gyename.com/2024/08/yoshida-yasei-override.html) |
| テレパシ | DECO*27 | [公開音名採譜](https://www.gyename.com/2025/03/deco27-telepathy.html) |
| みむかｩわナイストライ | ぬぬぬぬぬぬぬぬぬぬぬぬぬぬぬぬ | 公式動画を参考にした簡略フレーズ |
| ダイダイダイダイダイキライ | 雨良 Amala | [ピアノアレンジ](https://store.piascore.com/scores/340349) |
| いますぐ輪廻 | なきそ | [公開音名採譜](https://www.gyename.com/2025/08/nakiso-retry-now.html) |
| アンノウン・マザーグース | wowaka | [まらしぃ ピアノ楽譜集](https://www.ymm.co.jp/p/detail.php?code=GTP01100045&dm=sl&dso=2) |
| 熱異常 | いよわ | [ピアノアレンジの公開サンプル](https://store.piascore.com/scores/332566) |

譜面は、短い主旋律の輪郭を1オクターブに収めて反復・簡略化した練習用アレンジです。フル尺の時間範囲に配置しますが、曲全体の正確な採譜ではありません。拍・音域・一部の調を演奏しやすく変更しています。音源や楽譜本体は配布していません。原曲・映像・楽譜の権利は各権利者に帰属し、本ゲームは非公式です。


### 追加セレクション（10曲）

まどマギ5曲と、osu!のRanked・Loved等で親しまれている定番5曲を追加しました。最新ランキング順ではありません。動画は作者・権利者の公式チャンネルまたは公式配信のTopic音源を使用し、ClariSの3曲は公式セルフカバー「season 03」版です。2026-10-25に動画の長さと埋め込み可否を確認しました。

| 曲 | 作者 | 動画の長さ | 選曲元・曲情報 |
| --- | --- | --- | --- |
| コネクト -season 03- | ClariS | 4:33 | [公式MV](https://www.youtube.com/watch?v=eNvD-D6Gw6c) |
| Magia | Kalafina | 5:19 | [公式MV](https://www.youtube.com/watch?v=ks8WPvlQpbg) |
| ルミナス -season 03- | ClariS | 4:10 | [公式Lyric Video](https://www.youtube.com/watch?v=Rlp_4FQESts) |
| カラフル -season 03- | ClariS | 4:34 | [公式Lyric Video](https://www.youtube.com/watch?v=xV0ccSNorlM) |
| 君の銀の庭 | Kalafina | 5:07 | [公式配信](https://www.youtube.com/watch?v=kFhhLSbuXvI) |
| FREEDOM DiVE | xi | 4:30 | [osu!収録例](https://osu.ppy.sh/beatmapsets/39804) |
| Blue Zenith | xi | 4:19 | [osu!収録例](https://osu.ppy.sh/beatmapsets/292301) |
| GHOST | Camellia | 5:50 | [osu!収録例](https://osu.ppy.sh/beatmapsets/577187) |
| crystallized | Camellia | 4:37 | [osu!収録例](https://osu.ppy.sh/beatmapsets/438613) |
| Exit This Earth's Atomosphere | Camellia | 5:32 | [osu!収録例](https://osu.ppy.sh/beatmapsets/517474) |

追加曲は、曲調・テンポをもとに強弱や休符、左右のフレーズを変えた独自の簡略リズム譜面です。正確な主旋律の全曲採譜や、osu!の既存譜面の変換ではありません。EASY / NORMAL / HARDの3段階、フル尺、長押し・同時押し・HARD限定フリックに対応します。「君の銀の庭」の編集グリッドは3拍子です。選曲欄で「ボカロ」「まどマギ」「osu!」を絞り込めます。

### 太鼓の達人セレクション（5曲）

公式サウンドトラックで配信されている5曲を追加し、合計25曲になりました。選曲欄の「太鼓」で絞り込めます。全曲とも公式配信（太鼓の達人 / Bandai Namco Game Music）のYouTube埋め込みを使用し、2026-10-25にフル音源の長さ・再生・埋め込み可否を確認しました。

| 曲 | 主なクレジット | フル音源の長さ | 出典 |
| --- | --- | --- | --- |
| きたさいたま2000 | LindaAI-CUE | 2:01 | [公式サントラ](https://www.youtube.com/watch?v=TABWSPDMXaE) |
| まださいたま2000 | LindaAI-CUE | 2:09 | [公式サントラ](https://www.youtube.com/watch?v=j4LWHsmAufw) |
| 幽玄ノ乱 | 世阿弥 | 2:06 | [公式サントラ](https://www.youtube.com/watch?v=0xOwiA2gCtw) |
| ドンカマ2000 | LindaAI-CUE | 2:13 | [公式サントラ](https://www.youtube.com/watch?v=LEoxASk_V2g) |
| エンジェル ドリーム | 歌：たかみつようこ / 作曲：岡部啓一 | 2:26 | [公式サントラ](https://www.youtube.com/watch?v=qcfupB_h59M) |

譜面はフル尺・EASY / NORMAL / HARDの8鍵向けオリジナル簡略リズムアレンジです。左右の掛け合い、同時押し、長押しとHARD限定フリックを使います。原作のドン・カッ譜面やスクロールギミックを移植したものではなく、「ドンカマ2000」は120 BPMを基準にした簡略アレンジです。既存20曲の譜面・ランキングバージョンは変更しません。

### ボカロ追加曲（プロセカ高難度セレクション・10曲）

既存の「ボカロ」に10曲を追加し、ボカロ20曲・全体35曲にしました。ジャンルの別枠は増やしません。プロセカのULTIMATE採用曲や高難度の定番から選んでおり、最新の難易度順トップ10という意味ではありません。

| 曲 | 作者 | 公式動画の長さ | 公式音源 |
| --- | --- | --- | --- |
| 初音ミクの消失 | cosMo＠暴走P | 4:50 | [公式リメイク版](https://www.youtube.com/watch?v=VWVtIg5cdDU) |
| 初音ミクの激唱 | cosMo＠暴走P | 5:01 | [2018Remake](https://www.youtube.com/watch?v=MFEaIgMkR_0) |
| マシンガンポエムドール | cosMo＠暴走P | 2:24 | [公式動画](https://www.youtube.com/watch?v=UgZFpO_Y6qo) |
| 人生 | gcmstyle（アンメルツP） | 2:29 | [6人歌唱の公式動画](https://www.youtube.com/watch?v=wpVa0cnEeIw) |
| ヤミナベ!!!! | cosMo＠暴走P | 2:15 | [公式動画](https://www.youtube.com/watch?v=NFT6GMPeYJI) |
| What's up? Pop! | Capchii | 2:45 | [公式動画](https://www.youtube.com/watch?v=pS31mdpYuh4) |
| おぎゃりないざー | Ponchi♪ | 2:10 | [公式動画](https://www.youtube.com/watch?v=1AliuyQ3II4) |
| ダイジョブですか？ | cosMo＠暴走P | 2:36 | [公式動画](https://www.youtube.com/watch?v=2AD1jTs516E) |
| 腐れ外道とチョコレゐト | ピノキオピー | 3:21 | [公式動画](https://www.youtube.com/watch?v=sHnvEsNU1X0) |
| ÅMARA(大未来電脳) | sasakure.UK | 3:17 | [公式動画](https://www.youtube.com/watch?v=p6snD1650ck) |

全曲とも作者の公式動画を全尺で再生し、独自の8鍵向け簡略リズム譜面をEASY / NORMAL / HARDで用意しています。HARDは連続した左右交互打ち、同時押し、長押し中の別キー入力とフリックを組み合わせます。「ヤミナベ!!!!」はおおまかなテンポ区間を分けて配置し、他の変速曲は基準BPMを用いた簡略アレンジです。プロセカの既存譜面や難易度値の移植、正確な全曲採譜ではありません。消失・激唱はゲーム内の短縮版とは異なる公式リメイク版です。

選曲参考：[公式1周年告知（マシンガンポエムドール）](https://pjsekai.sega.jp/1st/index.html)、[作者による「人生」ULTIMATE採用報告](https://www.gcmstyle.com/winning-contest-jinsei/)、[公式大会規約（ÅMARA MASTER Lv34）](https://pjsekai.sega.jp/championship2024autumn/pjsekai_Championship2024Autumn_regulation.pdf)、[収録曲・難易度一覧](https://appmedia.jp/pjsekai/5298052)。一覧は更新停止のため最新順位の根拠には使用していません。全10曲の動画長と埋め込み可否は2026-10-25に確認しました。

## ローカル起動

Node.jsがあれば、追加パッケージは不要です。

```sh
node dev.mjs
```

表示されたローカルURLをブラウザで開きます。動画とオンラインランキングにはインターネット接続が必要です。

## 構成

ビルド不要のHTML / CSS / JavaScript。GitHub Pagesは`main`ブランチのルートを配信します。`engine.mjs`はブラウザとサーバーで共有する譜面・判定処理、`geometry.mjs`はレーンとノーツで共有する遠近投影です。`npm test`で判定・長押し・同時押し・投影・再生待機・カスタム譜面を検証できます。

オンライン機能はSupabase Edge Function `pulse-keys`と専用テーブルで保存します。初期構造は`cloud/schema.sql`、譜面公開の追加構造は`cloud/community.sql`です。`pulse_keys_charts`は公開譜面、`pulse_keys_chart_scores`は譜面ごとの記録、`pulse_keys_runs`は所有者付きプレイ情報、`pulse_keys_scores`は標準譜面の記録です。Edge Functionは`cloud/index.ts`をエントリーポイントとし、同じ配置の`cloud/service.mjs`とルートの`engine.mjs`・`expansion.mjs`・`taiko.mjs`・`proseka.mjs`を含めてデプロイします。長曲のコンボ上限拡張は`cloud/expanded-tracks.sql`です。

ブラウザに置くのは公開用キーだけです。テーブルはRLS有効、`anon` / `authenticated`に直接の読み書き権限はありません。公開APIが名前・スコアなどの表示項目のみ返します。端末ごとのランダムなトークンでプレイの所有を確認し、サーバーで入力履歴からスコアを再計算します。開始回数制限、完走時間確認、二重登録防止、自己ベストの原子的更新を行います。

これはコミュニティ向けランキングです。ブラウザの入力履歴を完全に不正耐性のあるものにはできず、競技大会用のアンチチートではありません。端末の保存領域を消すとプレイヤーID・設定・端末の自己ベストを失います。公開済みのスコアは残ります。

音楽はYouTubeの公式動画を埋め込んで再生するため、再生前・再生中にYouTubeの広告が入る場合があります。ゲームの開始画面と譜面の全画面内にも案内を表示します。

読み込み・バッファリング・本編の再生時間が止まっている間は、音量を0%にして「動画読み込み中」と表示し、譜面と判定も停止します。本編の再生時間が進むことを確認してから設定音量に戻します。待機しても音量設定そのものは書き換えません。広告が長くても18秒で強制停止せず、再生を待ちます。

[YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)には広告の検出・スキップを行う公開APIがなく、ゲーム側で「5秒後に自動スキップ」は実装していません。再生時間の進行を使った待機判定なので、広告中も本編と同じように時間が進む場合など、判別できない広告があります。全種類の広告の消音を保証するものではありません。必要な場合はVで全画面を解除して、YouTubeプレイヤー内のスキップや音量を操作できます。プレイヤーのシーク・再生速度変更を検出した回はランキング対象外です。

## 操作チュートリアル

タイトル下またはヘッダーの「チュートリアル」または遊び方から起動できます。単押し・長押し・同時押し・AIR・Spaceを押したままの帯に沿ったレーン移動を、実際の判定エンジンで順番に練習します。キー変更に対応し、失敗時は自動再挑戦。動画の読み込みやスコア送信は行いません。

難易度別の練習：EASYは単押し・長押し、NORMALは同時押しまで、HARDはSpaceフリックとレーン移動まで。HARDでもフリック練習をオフにできます。難易度を切り替えると練習を最初からやり直します。

動画の準備完了後は3秒のカウントダウンを表示し、その間は動画・譜面・判定を停止します。途中の読み込み待ちや一時停止からの再開にも準備時間を入れます。
