# デスクトップのファイルを食べる機能 — 実装プラン

> 状態: **未実装（設計のみ）**。実装は後日。
> 対象リポジトリ: `bugpoop-desktop`
> 前提: 既存の「食べる → うんこ → 触れて復元」の仕組み（`EatenMatter` / `Dropping` /
> `DesktopHabitat.eat()` / `restore()`）をそのまま流用する。

---

## 0. 結論

- **実装可能。** 難所だと思っていた「アイコンの実座標」は取得できる見込みが立った（`desktop position`）。
- 本当に作り込むべきは**安全策**（削除しない・戻せる・既定OFF・権限）。
- 見積り: **半日〜1日**（ファイル操作は簡単、安全策と権限まわりが本体）。

---

## 1. 決定事項（合意済み）

| 項目 | 決定 |
| --- | --- |
| 対象フォルダ | **デスクトップのみ** |
| 齧る位置 | **実アイコン座標**（Finder の `desktop position`） |
| 復元方法 | **うんこに触れて個別復元** |
| 保存先 | `/tmp` ではなく **永続フォルダ**（後述） |
| 削除 | **絶対にしない**（移動のみ） |
| 既定 | **OFF**（設定トグルで有効化、警告つき） |

---

## 2. 調査結果（実測済み・2026-09-28）

| 方法 | 結果 | 使える？ |
| --- | --- | --- |
| `position of every item of desktop` | 全部 `-1, -1`（フォルダ用プロパティ） | × |
| **`desktop position of every item of desktop`** | **実座標が返る** | ○ |
| `~/Desktop/.DS_Store` の `Iloc` | 0件 | × |
| `~/Desktop/.DS_Store` の `dilc` | 396件（32バイトblob、形式は非公開） | △（形式解明が必要） |
| System Events（アクセシビリティ） | Finder のデスクトップはウィンドウ非公開 | × |
| `screencapture` | 画面収録の許可が無いと失敗 | △（許可すれば画像検出可） |

### 実データ（この Mac の実測）

```
items: 346
fallback cell (1746, 91) used by 115 items   ← 画面外 / 未配置の既定値クラスタ
real-position items: 231  (distinct cells: 223)
```

実座標サンプル（原点は左上、単位はポイント）:

```
x= 1762 y=  107  DriftField-0.2.0-macOS-universal
x= 1746 y=  203  vid.wav
x= 1734 y=   80  cumbia hardoff.mp3
x= 1591 y=  223  ChatGPT Image Aug 21...png
x= 1232 y=  562  07042026
x=  101 y=  514  92c35a83-....png
```

### 再現コマンド（1回の呼び出しで名前と座標を対応付ける）

```sh
osascript <<'EOF'
set text item delimiters to "\n"
tell application "Finder"
  set ns to name of every item of desktop
  set ps to desktop position of every item of desktop
  set out to {}
  repeat with i from 1 to (count of ns)
    set p to item i of ps
    set end of out to ((item i of ns) & "\t" & ((item 1 of p) as string) & "\t" & ((item 2 of p) as string))
  end repeat
  return out as string
end tell
EOF
```

- `position`（フォルダ用）ではなく **`desktop position`** を使うこと。
- 返る座標は**アイコン中心**、原点は画面左上、y は下向き。
- **既定セル（最多出現セル、例 `1746,91`）は「画面外/未配置」**なので除外する。
- 自動整列（Sort by）を変えると座標が変わるので、**噛む直前に取り直す**。
- 一部セルは複数名で共有（古い記録/重複）→ **セル単位で1ファイル**を選ぶ。

---

## 3. アーキテクチャ（既存コードへの差し込み）

```
renderer (src/adapters/desktopHabitat.ts)
  - main から「噛める場所（実アイコン座標つき）」のキャッシュを受け取る
  - eat(edible)   : キャッシュから1件選び、IPC で main に移動を依頼し、EatenMatter を返す
  - restore(matter): IPC で main に復元を依頼（うんこ触れ → 既存の returnProgress 演出）

main (electron/main.ts もしくは electron/desktopFiles.ts)
  - fs / osascript を所有（renderer に任意FS権限を渡さない）
  - desktop:list / desktop:eat / desktop:restore / desktop:restoreAll
  - 永続 index.json の読み書き
```

既存の流れはそのまま使える：

```
空腹 → 目標の「食べ物（ここではアイコン）」へ移動 → 咀嚼 → 飲み込み(EatenMatter)
      → 消化 → うんこ（matter 保持）→ 触れる → restore()
```

`DesktopHabitat` は現状「見えない点を消すだけ」。ここを実ファイルに差し替えるのが本作業。

---

## 4. データモデル

保存先（永続、`/tmp` はOSに消されるので不可）:

```
~/Library/Application Support/Bugpoop/eaten/
  index.json
  <id>/<originalName>     ← 実際のファイル
```

`index.json`:

```json
[
  {
    "id": "e-1759...-ab12",
    "name": "foo.png",
    "originalPath": "/Users/xxx/Desktop/foo.png",
    "storedPath": "/Users/xxx/Library/Application Support/Bugpoop/eaten/e-.../foo.png",
    "size": 12345,
    "mtimeMs": 1759000000000,
    "eatenAt": 1759000000000
  }
]
```

- 起動時に `index.json` を読み、うんこ（droppings）を復元表示できるようにする（任意）。
- クラッシュしても `index.json` から復元可能。

---

## 5. 座標取得の実装メモ

1. 60秒ごと、または「次に噛むとき」に `osascript` で `name + desktop position` を取得。
2. 既定セル（最多出現セル）を除外。
3. セル重複を解消（同一セルは最新 mtime の1件を採用）。
4. `~/Desktop` の実ファイルと突き合わせ（`fs.readdir`）。
   - ファイルのみ（ディレクトリ・`.app`・`.DS_Store`・隠しファイル・シンボリックリンクを除外）。
5. オーバーレイ座標へ変換。
   - 1ディスプレイ: そのまま（オーバーレイ原点 = 画面左上）。
   - Reel mode: 左1/4のストリップ内にクランプ。
   - マルチディスプレイ: ディスプレイ原点ぶんオフセット。

---

## 6. 安全策（必須）

- **削除しない**。`fs.rename` による移動のみ。
- **既定OFF**。設定に「デスクトップのファイルを食べる」トグル＋警告。
- ファイルのみ。サイズ上限（例 100MB）を超えるものは対象外。
- 隠しファイル・`.DS_Store`・シンボリックリンク・ディレクトリ・`.app` を除外。
- **復元手段を必ず用意**：
  - うんこに触れて個別復元（原作どおり、回転して消える演出）。
  - 設定/トレイに「全部戻す（Restore all）」。
  - 起動時に `index.json` を読み、未復元があれば警告表示。
- **元の場所が埋まっていたら** `name (restored).ext` で戻す（上書きしない）。
- 元フォルダが無い場合はデスクトップへ戻す。
- ユーザーが既に消した/移動したファイルは「復元不能」として扱い、エラーにしない。

---

## 7. 権限（macOS）

- **デスクトップ フォルダのアクセス**（TCC）: 初回に「デスクトップ内のファイルへのアクセス」許可ダイアログ。
- **オートメーション（Finder の制御）**: `osascript` 実行時に「Bugpoop が Finder を制御しようとしています」許可ダイアログ。
- 署名が ad-hoc だと、バイナリ更新のたびに許可が再度出る可能性。配布するなら署名を検討。
- 拒否された場合は機能を静かに無効化し、設定に理由を表示する。

---

## 8. 実装ステップ（チェックリスト）

**Phase A — main のファイルサービス**
- [ ] `electron/desktopFiles.ts` 新規: `listDesktopIcons()`（osascript）/ `eatFile()` / `restoreFile()` / `restoreAll()` / `readIndex()` / `writeIndex()`
- [ ] 永続フォルダ `eaten/` と `index.json` の読み書き（原子的書き込み）

**Phase B — IPC / preload**
- [ ] `desktop:list` / `desktop:eat` / `desktop:restore` / `desktop:restoreAll`
- [ ] `petbridge.d.ts` と `electron/preload.ts` に型付きAPI追加

**Phase C — habitat 統合**
- [ ] `DesktopHabitat` に「実アイコン座標のキャッシュ」を持たせる
- [ ] `eat(edible)`: 実ファイルを食べる（IPC fire-and-forget）＋ `EatenMatter` にファイル名
- [ ] `restore(matter)`: IPC で戻す
- [ ] 既定OFFなら今までどおり（見えない点）

**Phase D — UI**
- [ ] 設定に「デスクトップのファイルを食べる」トグル
- [ ] 設定/トレイに「Restore all」
- [ ] 未復元ファイルがある場合の起動時表示

**Phase E — テスト**
- [ ] unit: 移動→復元ラウンドトリップ（一時ディレクトリ）
- [ ] unit: 名前衝突時の `(restored)` 付与
- [ ] unit: `index.json` の永続化・クラッシュ復帰
- [ ] unit: osascript 出力のパースと既定セル除外
- [ ] 手動: 実デスクトップで1件食べて戻す（opt-in）

**Phase F — ドキュメント**
- [ ] README に注意事項・権限・戻し方

---

## 9. エッジケース / 未解決事項

- `desktop position` は**自動整列だと「画面外/未配置」が既定セルに集約**される（115/346）。→ 既定セル除外で対応。
- 同一セルを複数名が共有する（古い記録・重複）→ セル単位で1件。
- ユーザーが Finder の並びを変えると座標が変わる → 噛む直前に再取得。
- 大きなファイル（数百MB〜）→ サイズ上限で除外。
- iCloud デスクトップ同期（Desktop & Documents）だとパスが特殊な場合あり。
- マルチディスプレイ時の座標オフセット。
- `.app` やフォルダは「ファイル限定」のため対象外。
- `dilc`（`.DS_Store`）を解明できれば Finder へのオートメーション権限すら不要にできる可能性（未解決・将来課題）。

---

## 10. 参考

- Finder AppleScript: `desktop position`（読み書き可）。`position` はフォルダ用で `-1` を返す。
- `.DS_Store`: `Iloc`（Icon Location）/ `dilc`（Desktop Icon Location）が存在。`dilc` は32バイトblobで形式は非公開。
- アクセシビリティ: `AXUIElementCopyElementAtPosition`（座標ヒットテスト）はあるが、デスクトップアイコンの列挙には不向き。
- 画面収録の許可があればスクショからの検出も可能（今回は不採用）。
