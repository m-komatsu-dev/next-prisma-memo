// このファイルは、Next.js のクライアント側で動くコンポーネントだと指定します。
"use client";

// ボタンに表示するアイコンを lucide-react から読み込みます。
import { ArrowDown, ArrowUp, CheckSquare, Square } from "lucide-react";
// React で使う型とフックを読み込みます。
import {
  // キーボード操作イベントの型です。
  type KeyboardEvent,
  // ref オブジェクトの型です。
  type RefObject,
  // 値の変化に合わせて処理を実行するフックです。
  useEffect,
  // 計算結果を必要な時だけ作り直すフックです。
  useMemo,
  // 画面の再描画に関係なく値を覚えておくフックです。
  useRef,
  // 画面に表示する状態を管理するフックです。
  useState,
} from "react";

// チェックボックス付きの TODO 行が持つデータの形を定義します。
type TodoLine = {
  // React が行を区別するための一意な ID です。
  id: string;
  // この行が TODO 行であることを表す印です。
  kind: "todo";
  // 入力された本文です。
  text: string;
  // チェック済みかどうかを表します。
  checked: boolean;
};

// 通常のテキスト行が持つデータの形を定義します。
type TextLine = {
  // React が行を区別するための一意な ID です。
  id: string;
  // この行が普通のテキスト行であることを表す印です。
  kind: "text";
  // 入力された本文です。
  text: string;
};

// エディタ上の 1 行は、TODO 行またはテキスト行のどちらかです。
type EditorLine = TodoLine | TextLine;

// TodoListEditor コンポーネントが親から受け取る props の形を定義します。
type TodoListEditorProps = {
  // フォーム送信時に使う input の名前です。
  name: string;
  // 親コンポーネントから渡される現在の本文全体です。
  value: string;
  // 本文が変わった時に親へ知らせる関数です。
  onChange: (value: string) => void;
  // 入力が空の時に表示する案内文です。
  placeholder?: string;
};

// TodoListContent コンポーネントが親から受け取る props の形を定義します。
type TodoListContentProps = {
  // 表示したい本文全体です。
  content: string;
  // 本文が空の時に表示する文です。
  emptyText?: string;
};

// 「- [ ] テキスト」や「- [x] テキスト」という TODO 記法を見つける正規表現です。
const TODO_PATTERN = /^(\s*)-\s+\[([ xX])\]\s?(.*)$/;

// 行ごとに使う一意な ID を作る関数です。
function createLineId() {
  // 現在時刻とランダム文字列を組み合わせ、重なりにくい ID を返します。
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// 文字列 1 行を、エディタが扱いやすいデータに変換する関数です。
function parseLine(rawLine: string): EditorLine {
  // 行が TODO 記法に一致するか調べます。
  const todoMatch = rawLine.match(TODO_PATTERN);
  // TODO 記法でなければ、普通のテキスト行として扱います。
  if (!todoMatch) {
    // 新しい ID を付けて、テキスト行のデータを返します。
    return { id: createLineId(), kind: "text", text: rawLine };
  }

  // TODO 記法だった場合は、チェック状態と本文を取り出して TODO 行として返します。
  return {
    // この行専用の ID を作ります。
    id: createLineId(),
    // TODO 行であることを示します。
    kind: "todo",
    // [x] または [X] ならチェック済み、それ以外なら未チェックにします。
    checked: todoMatch[2].toLowerCase() === "x",
    // TODO の本文部分を入れます。
    text: todoMatch[3],
  };
}

// 本文全体の文字列を、行データの配列に変換する関数です。
function parseContent(content: string): EditorLine[] {
  // 本文があれば改行で分け、空なら空行 1 つとして扱います。
  const lines = content.length ? content.split("\n") : [""];
  // それぞれの行を parseLine で変換します。
  return lines.map(parseLine);
}

// エディタ用の 1 行データを、保存用の文字列 1 行に戻す関数です。
function serializeLine(line: EditorLine) {
  // TODO 行なら Markdown 風のチェックリスト記法にします。
  if (line.kind === "todo") {
    // チェック済みなら x、未チェックなら空白を入れて文字列を作ります。
    return `- [${line.checked ? "x" : " "}] ${line.text}`;
  }

  // テキスト行なら本文をそのまま返します。
  return line.text;
}

// 行データの配列を、保存用の本文全体の文字列に戻す関数です。
function serializeLines(lines: EditorLine[]) {
  // 各行を文字列に戻してから、改行でつなぎます。
  return lines.map(serializeLine).join("\n");
}

// 指定した TODO 行が属している、連続した TODO ブロックの範囲を探す関数です。
function findTodoBlock(lines: EditorLine[], index: number) {
  // ブロックの開始位置を、ひとまず指定された行にします。
  let start = index;
  // ブロックの終了位置も、ひとまず指定された行にします。
  let end = index;

  // 上方向に TODO 行が続く限り、開始位置を 1 行ずつ上へ広げます。
  while (start > 0 && lines[start - 1].kind === "todo") start -= 1;
  // 下方向に TODO 行が続く限り、終了位置を 1 行ずつ下へ広げます。
  while (end < lines.length - 1 && lines[end + 1].kind === "todo") end += 1;

  // 見つけた開始位置と終了位置を返します。
  return { start, end };
}

// チェック済み TODO を、同じ TODO ブロックの下へ移動する関数です。
function moveCompletedToBottom(lines: EditorLine[], index: number) {
  // 指定された行が TODO 行でなければ、何も変更せず返します。
  if (lines[index]?.kind !== "todo") return lines;

  // 指定された行を含む TODO ブロックの範囲を探します。
  const { start, end } = findTodoBlock(lines, index);
  // TODO ブロックより前の行を取り出します。
  const before = lines.slice(0, start);
  // TODO ブロックそのものを取り出します。
  const block = lines.slice(start, end + 1);
  // TODO ブロックより後ろの行を取り出します。
  const after = lines.slice(end + 1);
  // 未完了の TODO を取り出します。
  const openItems = block.filter((line) => line.kind !== "todo" || !line.checked);
  // 完了済みの TODO を取り出します。
  const completedItems = block.filter((line) => line.kind === "todo" && line.checked);

  // 前の行、未完了、完了済み、後ろの行の順に並べ直して返します。
  return [...before, ...openItems, ...completedItems, ...after];
}

// 指定した行の input にフォーカスを当てる関数です。
function focusLine(
  // 各行 ID と input 要素を対応させて保存している ref です。
  inputRefs: RefObject<Map<string, HTMLTextAreaElement | null>>,
  // フォーカスしたい行の ID です。
  lineId: string | undefined,
) {
  // ID がない場合は何もしません。
  if (!lineId) return;

  // React が画面を更新した後にフォーカス処理を実行します。
  window.requestAnimationFrame(() => {
    // 行 ID に対応する input 要素を取り出します。
    const input = inputRefs.current.get(lineId);
    // input があればフォーカスします。
    input?.focus();
    // カーソルを末尾に置くため、入力文字数を調べます。
    const end = input?.value.length ?? 0;
    // 選択範囲を末尾に設定し、カーソルが最後に来るようにします。
    input?.setSelectionRange(end, end);
  });
}

// 編集できる TODO リストを表示するコンポーネントです。
export function TodoListEditor({
  // フォーム送信用の hidden input に使う名前です。
  name,
  // 親から渡される本文全体です。
  value,
  // 変更を親へ伝える関数です。
  onChange,
  // placeholder が指定されなかった場合の初期値です。
  placeholder = "本文を書き始める",
}: TodoListEditorProps) {
  // 各行の input 要素を、行 ID ごとに保存しておく ref です。
  const inputRefs = useRef<Map<string, HTMLTextAreaElement | null>>(new Map());
  // 画面に表示する行データを state として持ちます。
  const [lines, setLines] = useState<EditorLine[]>(() => parseContent(value));
  // 現在フォーカスされている行の ID を state として持ちます。
  const [activeLineId, setActiveLineId] = useState(lines[0]?.id ?? "");
  // 内部で最後に反映した本文を覚えて、不要な再変換を防ぎます。
  const internalValueRef = useRef(value);

  // 親から渡される value が外部で変わった時に、エディタ内部の行データを更新します。
  useEffect(() => {
    // 自分自身の編集で発生した value 変更なら、すでに反映済みなので何もしません。
    if (value === internalValueRef.current) return;
    // 新しい value を行データに変換します。
    const nextLines = parseContent(value);
    // 今回反映した value を記録します。
    internalValueRef.current = value;
    // 画面に表示する行データを更新します。
    setLines(nextLines);
    // 先頭行をアクティブ行として扱います。
    setActiveLineId(nextLines[0]?.id ?? "");
  }, [value]);

  // 現在フォーカスされている行が、配列の何番目かを計算します。
  const activeIndex = useMemo(
    // activeLineId と同じ ID を持つ行の位置を探します。
    () => lines.findIndex((line) => line.id === activeLineId),
    // activeLineId または lines が変わった時だけ計算し直します。
    [activeLineId, lines],
  );

  const resizeInput = (input: HTMLTextAreaElement | null) => {
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  };

  useEffect(() => {
    inputRefs.current.forEach((input) => resizeInput(input));
  }, [lines]);

  // 行データの変更を state と親コンポーネントの両方へ反映する関数です。
  const commitLines = (nextLines: EditorLine[], nextFocusId?: string) => {
    // 画面表示用の行データを更新します。
    setLines(nextLines);
    // 行データを保存用の文字列に変換します。
    const nextValue = serializeLines(nextLines);
    // 内部で反映済みの値として記録します。
    internalValueRef.current = nextValue;
    // 親コンポーネントへ変更後の本文を渡します。
    onChange(nextValue);
    // 次にフォーカスしたい行が指定されている場合だけ実行します。
    if (nextFocusId) {
      // アクティブ行の ID を更新します。
      setActiveLineId(nextFocusId);
      // 実際の input 要素へフォーカスを当てます。
      focusLine(inputRefs, nextFocusId);
    }
  };

  // 指定した行のテキストを更新する関数です。
  const updateLineText = (index: number, text: string) => {
    // 対象の行だけ text を差し替え、他の行はそのまま残します。
    const nextLines = lines.map((line, lineIndex) =>
      lineIndex === index ? { ...line, text } : line,
    );
    // 更新した行データを反映します。
    commitLines(nextLines);
  };

  // 指定した行を、テキスト行と TODO 行の間で切り替える関数です。
  const toggleLineKind = (index = activeIndex) => {
    // 対象行が見つからない場合は何もしません。
    if (index < 0) return;

    // 対象行だけ種類を切り替え、他の行はそのまま残します。
    const nextLines = lines.map((line, lineIndex) => {
      // 対象ではない行は変更しません。
      if (lineIndex !== index) return line;
      // TODO 行なら、同じ ID と本文を持つテキスト行に変換します。
      if (line.kind === "todo") return { id: line.id, kind: "text" as const, text: line.text };
      // テキスト行なら、未チェックの TODO 行に変換します。
      return { id: line.id, kind: "todo" as const, text: line.text, checked: false };
    });

    // 切り替え後の行データを反映し、対象行へフォーカスを戻します。
    commitLines(nextLines, nextLines[index]?.id);
  };

  // 指定した TODO 行のチェック状態を切り替える関数です。
  const toggleChecked = (index: number) => {
    // 対象行だけ checked を反転し、他の行はそのまま残します。
    const toggled = lines.map((line, lineIndex) =>
      lineIndex === index && line.kind === "todo"
        ? { ...line, checked: !line.checked }
        : line,
    );
    // チェック済みの TODO をブロックの下へ移動します。
    const nextLines = moveCompletedToBottom(toggled, index);
    // 操作した行の ID を覚えておきます。
    const focusId = toggled[index]?.id;
    // 並べ替え後の行データを反映し、操作した行へフォーカスを戻します。
    commitLines(nextLines, focusId);
  };

  // 指定した行の下に、新しい空行を追加する関数です。
  const insertLineAfter = (index: number, kind: EditorLine["kind"]) => {
    // 追加する行の種類に合わせて、空の行データを作ります。
    const nextLine: EditorLine =
      kind === "todo"
        ? { id: createLineId(), kind: "todo", text: "", checked: false }
        : { id: createLineId(), kind: "text", text: "" };
    // 指定した行の直後に新しい行を差し込みます。
    const nextLines = [...lines.slice(0, index + 1), nextLine, ...lines.slice(index + 1)];
    // 追加後の行データを反映し、新しい行へフォーカスします。
    commitLines(nextLines, nextLine.id);
  };

  // 指定した行を削除する関数です。
  const removeLine = (index: number) => {
    // 1 行しかない時は、行自体は残して空のテキスト行に戻します。
    if (lines.length === 1) {
      // 既存の ID を保ったまま、空のテキスト行を作ります。
      const nextLines: EditorLine[] = [{ id: lines[0].id, kind: "text", text: "" }];
      // 空行を反映し、その行へフォーカスします。
      commitLines(nextLines, nextLines[0].id);
      // ここで処理を終えます。
      return;
    }

    // 対象行だけを除いた配列を作ります。
    const nextLines = lines.filter((_, lineIndex) => lineIndex !== index);
    // 削除後は、基本的に 1 つ上の行へフォーカスします。
    const nextFocusId = nextLines[Math.max(0, index - 1)]?.id;
    // 削除後の行データを反映します。
    commitLines(nextLines, nextFocusId);
  };

  // 指定した行を上下へ移動する関数です。
  const moveLine = (index: number, direction: -1 | 1) => {
    // 移動先の行番号を計算します。
    const targetIndex = index + direction;
    // 範囲外へ移動しようとしている場合は何もしません。
    if (targetIndex < 0 || targetIndex >= lines.length) return;

    // 元の配列を壊さないようにコピーを作ります。
    const nextLines = [...lines];
    // 移動したい行を配列から一度取り出します。
    const [line] = nextLines.splice(index, 1);
    // 取り出した行を移動先の位置へ差し込みます。
    nextLines.splice(targetIndex, 0, line);
    // 並べ替え後の行データを反映し、移動した行へフォーカスします。
    commitLines(nextLines, line.id);
  };

  // 各 input でキーが押された時の処理です。
  const handleLineKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }

    // Ctrl または Command + Shift + 7 で、行の種類を切り替えます。
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "7") {
      // ブラウザの標準動作を止めます。
      event.preventDefault();
      // 現在の行を TODO 行またはテキスト行に切り替えます。
      toggleLineKind(index);
      // ここで処理を終えます。
      return;
    }

    // Enter キーで、現在の行の下に新しい行を作ります。
    if (event.key === "Enter") {
      // フォーム送信などの標準動作を止めます。
      event.preventDefault();
      // 現在の行が TODO なら TODO 行、テキストならテキスト行を追加します。
      insertLineAfter(index, lines[index].kind === "todo" ? "todo" : "text");
      // ここで処理を終えます。
      return;
    }

    // 空の行で Backspace を押したら、その行を削除します。
    if (event.key === "Backspace" && lines[index].text.length === 0) {
      // ブラウザの標準動作を止めます。
      event.preventDefault();
      // 現在の行を削除します。
      removeLine(index);
      // ここで処理を終えます。
      return;
    }

    // Alt + 上矢印で、行を 1 つ上へ移動します。
    if (event.key === "ArrowUp" && event.altKey) {
      // カーソル移動などの標準動作を止めます。
      event.preventDefault();
      // 現在の行を上へ移動します。
      moveLine(index, -1);
      // ここで処理を終えます。
      return;
    }

    // Alt + 下矢印で、行を 1 つ下へ移動します。
    if (event.key === "ArrowDown" && event.altKey) {
      // カーソル移動などの標準動作を止めます。
      event.preventDefault();
      // 現在の行を下へ移動します。
      moveLine(index, 1);
    }
  };

  // エディタの見た目を JSX で返します。
  return (
    // エディタ全体を囲む div です。
    <div className="todo-editor">
      {/* フォーム送信用に、本文全体を hidden input として保持します。 */}
      <input type="hidden" name={name} value={serializeLines(lines)} />
      {/* チェックリスト操作用のツールバーです。 */}
      <div className="todo-editor__controls" aria-label="チェックリスト操作">
        {/* 現在の行をチェックボックス付き TODO 行に切り替えるボタンです。 */}
        <button type="button" className="todo-editor__toolbar-button" onClick={() => toggleLineKind()}>
          {/* チェックボックスのアイコンを表示します。 */}
          <CheckSquare size={16} aria-hidden="true" />
          {/* ボタンに表示する文字です。 */}
          チェックボックス
        </button>
        {/* キーボードショートカットの説明を表示します。 */}
        <span>ショートカット: Ctrl/⌘ + Shift + 7</span>
      </div>
      {/* 入力行の一覧を囲む div です。 */}
      <div className="todo-editor__lines">
        {/* lines 配列の各行を画面上の入力行に変換して表示します。 */}
        {lines.map((line, index) => (
          // 1 行分の表示を囲む div です。
          <div
            // チェック済み TODO の場合だけ、追加の CSS クラスを付けます。
            className={`todo-editor__line ${
              line.kind === "todo" && line.checked ? "todo-editor__line--checked" : ""
            }`}
            // React が行を区別するため、行 ID を key にします。
            key={line.id}
          >
            {/* TODO 行ならチェックボタン、テキスト行なら幅合わせ用の空要素を表示します。 */}
            {line.kind === "todo" ? (
              // TODO のチェック状態を切り替えるボタンです。
              <button
                // フォーム送信をしない普通のボタンにします。
                type="button"
                // チェックボタン用の CSS クラスです。
                className="todo-editor__check-button"
                // 画面読み上げ向けに、ボタンの意味を状態に応じて変えます。
                aria-label={line.checked ? "未完了に戻す" : "完了にする"}
                // 押されている状態かどうかを支援技術へ伝えます。
                aria-pressed={line.checked}
                // クリックされたらチェック状態を切り替えます。
                onClick={() => toggleChecked(index)}
              >
                {/* チェック済みなら塗られたアイコン、未チェックなら空のアイコンを表示します。 */}
                {line.checked ? <CheckSquare size={18} /> : <Square size={18} />}
              </button>
            ) : (
              // テキスト行ではチェックボタンの分だけ空白を作り、入力欄の位置を揃えます。
              <span className="todo-editor__text-spacer" aria-hidden="true" />
            )}
            {/* 行の本文を入力する textarea です。 */}
            <textarea
              rows={1}
              // この textarea 要素を行 ID と一緒に ref へ保存します。
              ref={(node) => {
                // input が存在する間は Map に登録します。
                inputRefs.current.set(line.id, node);
                resizeInput(node);
                // input が消えた時は Map から削除します。
                if (!node) inputRefs.current.delete(line.id);
              }}
              // input に表示する現在の本文です。
              value={line.text}
              // フォーカスされたら、この行をアクティブ行として記録します。
              onFocus={() => setActiveLineId(line.id)}
              // 入力内容が変わったら、対応する行の text を更新します。
              onChange={(event) => {
                resizeInput(event.currentTarget);
                updateLineText(index, event.target.value);
              }}
              // キー操作があったら、Enter や Backspace などの特別な処理を行います。
              onKeyDown={(event) => handleLineKeyDown(event, index)}
              // input 用の CSS クラスです。
              className="todo-editor__input"
              // 1 行だけで空の時だけ placeholder を表示します。
              placeholder={lines.length === 1 && !line.text ? placeholder : ""}
            />
            {/* 行を上下に並び替えるボタン群です。 */}
            <div className="todo-editor__move-buttons" aria-label="並び替え">
              {/* この行を 1 つ上へ移動するボタンです。 */}
              <button
                // フォーム送信をしない普通のボタンにします。
                type="button"
                // クリックされたら上へ移動します。
                onClick={() => moveLine(index, -1)}
                // 先頭行はこれ以上上へ移動できないので無効化します。
                disabled={index === 0}
                // 画面読み上げ向けのボタン名です。
                aria-label="上へ移動"
              >
                {/* 上向き矢印のアイコンを表示します。 */}
                <ArrowUp size={15} aria-hidden="true" />
              </button>
              {/* この行を 1 つ下へ移動するボタンです。 */}
              <button
                // フォーム送信をしない普通のボタンにします。
                type="button"
                // クリックされたら下へ移動します。
                onClick={() => moveLine(index, 1)}
                // 最終行はこれ以上下へ移動できないので無効化します。
                disabled={index === lines.length - 1}
                // 画面読み上げ向けのボタン名です。
                aria-label="下へ移動"
              >
                {/* 下向き矢印のアイコンを表示します。 */}
                <ArrowDown size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 保存済みの TODO リスト本文を、読み取り専用で表示するコンポーネントです。
export function TodoListContent({ content, emptyText = "本文はまだありません。" }: TodoListContentProps) {
  // content が変わった時だけ、本文を行データに変換し直します。
  const lines = useMemo(() => parseContent(content), [content]);

  // 空白を除いた本文が空なら、空状態のメッセージを表示します。
  if (!content.trim()) {
    // 本文がないことを伝える p 要素を返します。
    return <p className="todo-content__empty">{emptyText}</p>;
  }

  // 本文がある場合は、行ごとに表示用の JSX を返します。
  return (
    // 表示全体を囲む div です。
    <div className="todo-content">
      {/* lines 配列の各行を、TODO 行または段落として表示します。 */}
      {lines.map((line) =>
        // TODO 行ならチェックボックス風の表示にします。
        line.kind === "todo" ? (
          // TODO 1 行分の表示です。
          <div
            // React が行を区別するため、行 ID を key にします。
            key={line.id}
            // チェック済みなら追加の CSS クラスを付けます。
            className={`todo-content__line ${
              line.checked ? "todo-content__line--checked" : ""
            }`}
          >
            {/* チェック状態を表すアイコン部分です。 */}
            <span className="todo-content__checkbox" aria-hidden="true">
              {/* チェック済みなら塗られたアイコン、未チェックなら空のアイコンを表示します。 */}
              {line.checked ? <CheckSquare size={18} /> : <Square size={18} />}
            </span>
            {/* TODO の本文を表示します。空ならレイアウト維持のため空白を表示します。 */}
            <span>{line.text || " "}</span>
          </div>
        ) : (
          // テキスト行は段落として表示します。
          <p key={line.id} className="todo-content__paragraph">
            {/* 空の段落でも高さが残るように、通常の空白ではなく nbsp を表示します。 */}
            {line.text || "\u00a0"}
          </p>
        ),
      )}
    </div>
  );
}
