import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { generateMobileAiContent } from "./src/api/ai";
import { deleteMobileAccount, loginWithEmailPassword } from "./src/api/auth";
import {
  createMobilePost,
  deleteMobilePost,
  fetchMobilePost,
  fetchMobilePosts,
  MobileApiRequestError,
  updateMobilePost,
} from "./src/api/posts";
import {
  deleteStoredAccessToken,
  getStoredAccessToken,
  saveAccessToken,
} from "./src/storage/auth-token";
import { Badge, Button, Card, TextField } from "./src/components/ui";
import { colors, radius, spacing, typography } from "./src/theme";
import type { MobileAiMode, MobilePost, MobilePostPayload } from "./src/types/posts";

type ViewMode = "list" | "detail" | "create" | "edit" | "account";
type AuthViewMode = "landing" | "login";
type AutoSaveStatus = "unsaved" | "saving" | "saved" | "error";
type StatusFilter = "all" | "mine" | "published" | "private";
type SortMode = "updated-desc" | "created-desc" | "title-asc";
type EditorLine =
  | {
      id: string;
      kind: "text";
      text: string;
    }
  | {
      checked: boolean;
      id: string;
      kind: "todo";
      text: string;
    };

const AUTO_SAVE_DEBOUNCE_MS = 1500;

const aiTasks: { label: string; mode: MobileAiMode }[] = [
  { label: "タイトル生成", mode: "title" },
  { label: "タグ生成", mode: "tags" },
  { label: "要約を追加", mode: "summarize" },
  { label: "リライトを追加", mode: "rewrite" },
];

const features = [
  {
    title: "すぐに書ける",
    description: "思いついた瞬間にメモを残し、あとから迷わず見返せます。",
  },
  {
    title: "自分だけの一覧",
    description: "ログインしたユーザーごとに、必要なメモへ素早くアクセスできます。",
  },
  {
    title: "全世界へ共有",
    description: "メモの設定を切り替えるだけで、全世界に公開できます。",
  },
];

const statusFilters: { label: string; value: StatusFilter }[] = [
  { label: "すべて", value: "all" },
  { label: "自分", value: "mine" },
  { label: "公開", value: "published" },
  { label: "非公開", value: "private" },
];

const sortOptions: { label: string; value: SortMode }[] = [
  { label: "更新日", value: "updated-desc" },
  { label: "作成日", value: "created-desc" },
  { label: "タイトル", value: "title-asc" },
];

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function getPlainPreview(content: string) {
  return parseEditorContent(content)
    .map((line) => line.text)
    .join("\n")
    .trim();
}

function getTagsInput(post?: MobilePost | null) {
  return post?.tags.map((tag) => tag.name).join(", ") ?? "";
}

function getPayloadSignature(payload: MobilePostPayload) {
  return JSON.stringify({
    content: payload.content,
    published: payload.published,
    tags: payload.tags,
    title: payload.title,
  });
}

function getNormalizedPayload(payload: MobilePostPayload): MobilePostPayload {
  return {
    ...payload,
    content: normalizeChecklistContentForSave(payload.content),
  };
}

function canAutoSavePayload(payload: MobilePostPayload) {
  return Boolean(payload.title.trim() && payload.content.trim());
}

function getAutoSaveStatusText(status: AutoSaveStatus) {
  if (status === "saving") return "保存中...";
  if (status === "saved") return "保存済み";
  if (status === "error") return "保存失敗";
  return "未保存";
}

function appendAiSection(currentContent: string, result: string, heading: string) {
  return `${currentContent.trimEnd()}\n\n\n--- ${heading} ---\n${result}`.trimStart();
}

const TODO_LINE_PATTERN = /^(\s*)-\s+\[([ xX])\]\s?(.*)$/;

function createEditorLineId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseEditorLine(rawLine: string): EditorLine {
  const match = rawLine.match(TODO_LINE_PATTERN);

  if (!match) {
    return {
      id: createEditorLineId(),
      kind: "text",
      text: rawLine,
    };
  }

  return {
    checked: match[2].toLowerCase() === "x",
    id: createEditorLineId(),
    kind: "todo",
    text: match[3],
  };
}

function parseEditorContent(content: string) {
  const rawLines = content.length > 0 ? content.split("\n") : [""];
  return rawLines.map(parseEditorLine);
}

function serializeEditorLine(line: EditorLine) {
  if (line.kind === "todo") {
    return `- [${line.checked ? "x" : " "}] ${line.text}`;
  }

  return line.text;
}

function serializeEditorLines(lines: EditorLine[]) {
  return lines.map(serializeEditorLine).join("\n");
}

function normalizeChecklistContentForSave(content: string) {
  return parseEditorContent(content)
    .filter((line) => line.kind !== "todo" || line.text.trim().length > 0)
    .map(serializeEditorLine)
    .join("\n")
    .trimEnd();
}

function moveCompletedTodoToBottom(lines: EditorLine[], index: number) {
  if (lines[index]?.kind !== "todo") return lines;

  let start = index;
  let end = index;

  while (start > 0 && lines[start - 1].kind === "todo") start -= 1;
  while (end < lines.length - 1 && lines[end + 1].kind === "todo") end += 1;

  const before = lines.slice(0, start);
  const block = lines.slice(start, end + 1);
  const after = lines.slice(end + 1);
  const openItems = block.filter((line) => line.kind !== "todo" || !line.checked);
  const completedItems = block.filter(
    (line) => line.kind === "todo" && line.checked,
  );

  return [...before, ...openItems, ...completedItems, ...after];
}

function getFormattedCopyContent(post: MobilePost) {
  const tagLine = post.tags.map((tag) => `#${tag.name}`).join(" ");
  return `タイトル: ${post.title}\nタグ: ${tagLine || "未分類"}\n---\n${post.content}`;
}

function modeForAutoSave(viewMode: ViewMode, postId: number | null) {
  return viewMode === "create" && !postId ? "create" : "update";
}

function HomeLanding({
  onLoginPress,
  onRegisterPress,
}: {
  onLoginPress: () => void;
  onRegisterPress: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.landingContent}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>M</Text>
        </View>
        <Text style={styles.brandText}>My Memo App</Text>
      </View>

      <View style={styles.heroCopy}>
        <Text style={styles.kicker}>My Memo App</Text>
        <Text style={styles.heroTitle}>
          思考を逃さず、すっきり整理するメモ空間。
        </Text>
        <Text style={styles.heroLead}>
          日々のアイデア、タスク、学びを軽やかに残せるプライベートなメモアプリです。
          ログインして、あなたのメモ一覧へすぐに進めます。
        </Text>
      </View>

      <View style={styles.heroActions}>
        <Button onPress={onLoginPress} style={styles.heroActionButton}>
          ログインする
        </Button>
        <Button
          onPress={onRegisterPress}
          style={styles.heroActionButton}
          variant="secondary"
        >
          新規登録
        </Button>
      </View>

      <Card style={[styles.heroStats, styles.flatSurface]}>
        <View style={styles.heroStatItem}>
          <Text style={styles.heroStatTitle}>Fast</Text>
          <Text style={styles.heroStatText}>すぐ書ける導線</Text>
        </View>
        <View style={styles.heroStatItem}>
          <Text style={styles.heroStatTitle}>Private</Text>
          <Text style={styles.heroStatText}>自分のメモを管理</Text>
        </View>
        <View style={[styles.heroStatItem, styles.heroStatItemLast]}>
          <Text style={styles.heroStatTitle}>Clean</Text>
          <Text style={styles.heroStatText}>読み返しやすいUI</Text>
        </View>
      </Card>

      <View style={styles.featureGrid}>
        {features.map((feature) => (
          <Card key={feature.title} style={[styles.featureCard, styles.flatSurface]}>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureText}>{feature.description}</Text>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

function PostContentPreview({ content }: { content: string }) {
  const lines = useMemo(() => parseEditorContent(content), [content]);
  const hasContent = getPlainPreview(content).length > 0;
  const visibleLines = lines
    .filter((line) => line.kind !== "todo" || line.text.trim().length > 0)
    .slice(0, 6);

  if (!hasContent || visibleLines.length === 0) {
    return (
      <Text style={styles.cardContent} numberOfLines={2}>
        本文はまだありません。
      </Text>
    );
  }

  return (
    <View style={styles.cardContentPreview}>
      {visibleLines.map((line, index) => {
        if (line.kind !== "todo") {
          return (
            <Text
              key={`${line.id}-${index}`}
              numberOfLines={2}
              style={styles.cardContentPreviewText}
            >
              {line.text || " "}
            </Text>
          );
        }

        return (
          <View key={`${line.id}-${index}`} style={styles.cardTodoPreviewLine}>
            <View
              style={[
                styles.cardTodoCheckbox,
                line.checked ? styles.todoCheckboxChecked : undefined,
              ]}
            >
              {line.checked ? (
                <Text style={styles.cardTodoCheckboxMark}>x</Text>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.cardTodoPreviewText,
                line.checked ? styles.todoTextChecked : undefined,
              ]}
            >
              {line.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function PostCard({
  onPress,
  post,
}: {
  onPress: () => void;
  post: MobilePost;
}) {
  const updatedAt = useMemo(
    () => formatUpdatedAt(post.updatedAt),
    [post.updatedAt],
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.buttonPressed : undefined]}
    >
      <Card style={styles.memoCard}>
        <View style={styles.memoCardMain}>
          <View style={styles.cardBadgeRow}>
            <Badge variant={post.published ? "public" : "default"}>
              {post.published ? "公開" : "非公開"}
            </Badge>
          </View>

          <Text style={styles.cardTitle} numberOfLines={2}>
            {post.title}
          </Text>

          <PostContentPreview content={post.content} />

          <View style={styles.tagRow}>
            {post.tags.length > 0 ? (
              post.tags.map((tag) => (
                <Badge key={tag.id} variant="tag">
                  #{tag.name}
                </Badge>
              ))
            ) : (
              <Text style={styles.noTags}>タグなし</Text>
            )}
          </View>

          <View style={styles.memoDates}>
            <View style={styles.memoDateItem}>
              <Text style={styles.memoDateLabel}>更新</Text>
              <Text style={styles.memoDateValue}>{updatedAt}</Text>
            </View>
            <View style={styles.memoDateItem}>
              <Text style={styles.memoDateLabel}>作成</Text>
              <Text style={styles.memoDateValue}>
                {formatUpdatedAt(post.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function TodoContentDisplay({ content }: { content: string }) {
  const lines = content.trim() ? content.split("\n") : [];

  if (lines.length === 0) {
    return <Text style={styles.detailBody}>本文はまだありません。</Text>;
  }

  return (
    <View style={styles.todoContent}>
      {lines.map((line, index) => {
        const match = line.match(TODO_LINE_PATTERN);

        if (!match) {
          return (
            <Text key={`${line}-${index}`} style={styles.todoParagraph}>
              {line || " "}
            </Text>
          );
        }

        const checked = match[2].toLowerCase() === "x";

        return (
          <View
            key={`${line}-${index}`}
            style={[
              styles.todoLine,
              checked ? styles.todoLineChecked : undefined,
            ]}
          >
            <View
              style={[
                styles.todoCheckbox,
                checked ? styles.todoCheckboxChecked : undefined,
              ]}
            >
              {checked ? <Text style={styles.todoCheckboxMark}>x</Text> : null}
            </View>
            <Text
              style={[
                styles.todoText,
                checked ? styles.todoTextChecked : undefined,
              ]}
            >
              {match[3] || " "}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function TodoListEditor({
  editable,
  onChange,
  value,
}: {
  editable: boolean;
  onChange: (nextContent: string) => void;
  value: string;
}) {
  const [lines, setLines] = useState<EditorLine[]>(() => parseEditorContent(value));
  const [activeLineId, setActiveLineId] = useState(lines[0]?.id ?? "");
  const inputRefs = useRef<Map<string, TextInput | null>>(new Map());
  const internalValueRef = useRef(value);

  useEffect(() => {
    if (value === internalValueRef.current) {
      return;
    }

    const nextLines = parseEditorContent(value);
    internalValueRef.current = value;
    setLines(nextLines);
    setActiveLineId(nextLines[0]?.id ?? "");
  }, [value]);

  const commitLines = useCallback(
    (nextLines: EditorLine[], nextFocusId?: string) => {
      setLines(nextLines);

      const nextValue = serializeEditorLines(nextLines);
      internalValueRef.current = nextValue;
      onChange(nextValue);

      if (nextFocusId) {
        setActiveLineId(nextFocusId);
        requestAnimationFrame(() => {
          inputRefs.current.get(nextFocusId)?.focus();
        });
      }
    },
    [onChange],
  );

  const activeLineIndex = useMemo(
    () => lines.findIndex((line) => line.id === activeLineId),
    [activeLineId, lines],
  );

  const appendTodoLine = useCallback(() => {
    const lastLine = lines[lines.length - 1];

    if (lastLine?.kind === "todo" && lastLine.text.trim().length === 0) {
      commitLines(lines, lastLine.id);
      return;
    }

    const nextLine: EditorLine = {
      checked: false,
      id: createEditorLineId(),
      kind: "todo",
      text: "",
    };

    commitLines([...lines, nextLine], nextLine.id);
  }, [commitLines, lines]);

  const toggleActiveLineKind = useCallback(() => {
    const targetIndex = activeLineIndex >= 0 ? activeLineIndex : lines.length - 1;

    if (targetIndex < 0) {
      appendTodoLine();
      return;
    }

    const nextLines = lines.map((line, index) => {
      if (index !== targetIndex) return line;

      if (line.kind === "todo") {
        return {
          id: line.id,
          kind: "text" as const,
          text: line.text,
        };
      }

      return {
        checked: false,
        id: line.id,
        kind: "todo" as const,
        text: line.text,
      };
    });

    commitLines(nextLines, nextLines[targetIndex]?.id);
  }, [activeLineIndex, appendTodoLine, commitLines, lines]);

  const toggleChecked = useCallback(
    (index: number) => {
      const toggledLines = lines.map((line, lineIndex) =>
        lineIndex === index && line.kind === "todo"
          ? {
              ...line,
              checked: !line.checked,
            }
          : line,
      );
      const nextLines = moveCompletedTodoToBottom(toggledLines, index);
      const focusId = toggledLines[index]?.id;

      commitLines(nextLines, focusId);
    },
    [commitLines, lines],
  );

  const removeLine = useCallback(
    (index: number) => {
      if (lines.length === 1) {
        const nextLines: EditorLine[] = [
          {
            id: lines[0].id,
            kind: "text",
            text: "",
          },
        ];
        commitLines(nextLines, nextLines[0].id);
        return;
      }

      const nextLines = lines.filter((_, lineIndex) => lineIndex !== index);
      const nextFocusId = nextLines[Math.max(index - 1, 0)]?.id;
      commitLines(nextLines, nextFocusId);
    },
    [commitLines, lines],
  );

  const updateLineText = useCallback(
    (index: number, nextText: string) => {
      const currentLine = lines[index];
      if (!currentLine) return;

      if (nextText.includes("\n")) {
        const textParts = nextText.replace(/\r/g, "").split("\n");
        const replacementLines: EditorLine[] = textParts.map((textPart, partIndex) => {
          if (partIndex === 0) {
            return {
              ...currentLine,
              text: textPart,
            };
          }

          return currentLine.kind === "todo"
            ? {
                checked: false,
                id: createEditorLineId(),
                kind: "todo",
                text: textPart,
              }
            : {
                id: createEditorLineId(),
                kind: "text",
                text: textPart,
              };
        });
        const nextLines = [
          ...lines.slice(0, index),
          ...replacementLines,
          ...lines.slice(index + 1),
        ];
        const nextFocusId = replacementLines[1]?.id ?? replacementLines[0]?.id;

        commitLines(nextLines, nextFocusId);
        return;
      }

      const nextLines = lines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              text: nextText,
            }
          : line,
      );

      commitLines(nextLines);
    },
    [commitLines, lines],
  );

  return (
    <View style={styles.todoEditor}>
      <View style={styles.todoEditorToolbar}>
        <Button
          disabled={!editable}
          onPress={toggleActiveLineKind}
          style={styles.todoToolbarButton}
          variant="soft"
        >
          チェックボックス
        </Button>
        <Button
          disabled={!editable}
          onPress={appendTodoLine}
          style={styles.todoToolbarButton}
          variant="secondary"
        >
          チェック項目を追加
        </Button>
      </View>

      <View style={styles.todoEditorLines}>
        {lines.map((line, index) => {
          const isChecked = line.kind === "todo" && line.checked;

          return (
            <View
              key={line.id}
              style={[
                styles.todoEditorLine,
                isChecked ? styles.todoEditorLineChecked : undefined,
              ]}
            >
              {line.kind === "todo" ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: line.checked }}
                  disabled={!editable}
                  onPress={() => toggleChecked(index)}
                  style={({ pressed }) => [
                    styles.todoCheckButton,
                    pressed ? styles.buttonPressed : undefined,
                  ]}
                >
                  <View
                    style={[
                      styles.todoCheckbox,
                      line.checked ? styles.todoCheckboxChecked : undefined,
                    ]}
                  >
                    {line.checked ? (
                      <Text style={styles.todoCheckboxMark}>x</Text>
                    ) : null}
                  </View>
                </Pressable>
              ) : (
                <View style={styles.todoTextSpacer} />
              )}

              <TextInput
                blurOnSubmit={false}
                editable={editable}
                multiline
                onChangeText={(nextText) => updateLineText(index, nextText)}
                onFocus={() => {
                  setActiveLineId(line.id);
                }}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === "Backspace" && line.text.length === 0) {
                    removeLine(index);
                  }
                }}
                placeholder={lines.length === 1 && !line.text ? "本文を書き始める" : ""}
                placeholderTextColor="#a0a8b5"
                ref={(node) => {
                  inputRefs.current.set(line.id, node);
                  if (!node) {
                    inputRefs.current.delete(line.id);
                  }
                }}
                returnKeyType="default"
                style={[
                  styles.todoEditorInput,
                  isChecked ? styles.todoTextChecked : undefined,
                ]}
                textAlignVertical="top"
                value={line.text}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MemoForm({
  autoSaveError,
  error,
  initialPost,
  mode,
  onAutoSave,
  onCancel,
  onGenerateAi,
  onSubmit,
  saving,
}: {
  autoSaveError: string;
  error: string;
  initialPost?: MobilePost | null;
  mode: "create" | "edit";
  onAutoSave: (
    payload: MobilePostPayload,
    draftPostId: number | null,
  ) => Promise<MobilePost>;
  onCancel: () => void;
  onGenerateAi: (content: string, mode: MobileAiMode) => Promise<string>;
  onSubmit: (payload: MobilePostPayload, draftPostId: number | null) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [content, setContent] = useState(initialPost?.content ?? "");
  const [tags, setTags] = useState(getTagsInput(initialPost));
  const [published, setPublished] = useState(initialPost?.published ?? false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>(
    initialPost ? "saved" : "unsaved",
  );
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<MobileAiMode | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiStatusMessage, setAiStatusMessage] = useState("");
  const [draftPostId, setDraftPostId] = useState<number | null>(
    initialPost?.id ?? null,
  );
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveInFlightSignatureRef = useRef("");
  const draftPostIdRef = useRef<number | null>(initialPost?.id ?? null);
  const latestPayloadSignatureRef = useRef("");
  const onAutoSaveRef = useRef(onAutoSave);
  const titleRef = useRef(title);
  const tagsRef = useRef(tags);
  const lastSavedSignatureRef = useRef(
    initialPost
      ? getPayloadSignature({
          content: normalizeChecklistContentForSave(initialPost.content),
          published: initialPost.published,
          tags: getTagsInput(initialPost),
          title: initialPost.title,
        })
      : "",
  );

  const payload = useMemo(
    () =>
      getNormalizedPayload({
        content,
        published,
        tags,
        title,
      }),
    [content, published, tags, title],
  );

  useEffect(() => {
    latestPayloadSignatureRef.current = getPayloadSignature(payload);
  }, [payload]);

  useEffect(() => {
    onAutoSaveRef.current = onAutoSave;
  }, [onAutoSave]);

  useEffect(() => {
    draftPostIdRef.current = draftPostId;
  }, [draftPostId]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);

  useEffect(() => {
    const signature = getPayloadSignature(payload);

    if (
      signature === lastSavedSignatureRef.current ||
      signature === autoSaveInFlightSignatureRef.current
    ) {
      return;
    }

    setAutoSaveStatus("unsaved");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    if (!canAutoSavePayload(payload)) {
      return;
    }

    autoSaveTimerRef.current = setTimeout(() => {
      if (
        signature === lastSavedSignatureRef.current ||
        signature === autoSaveInFlightSignatureRef.current
      ) {
        return;
      }

      autoSaveTimerRef.current = null;
      autoSaveInFlightSignatureRef.current = signature;
      setAutoSaveStatus("saving");

      const draftPostIdAtSave = draftPostIdRef.current;

      onAutoSaveRef.current(payload, draftPostIdAtSave)
        .then((savedPost) => {
          draftPostIdRef.current = savedPost.id;
          setDraftPostId(savedPost.id);
          lastSavedSignatureRef.current = signature;
          setAutoSaveStatus(
            latestPayloadSignatureRef.current === signature ? "saved" : "unsaved",
          );
        })
        .catch(() => {
          setAutoSaveStatus("error");
        })
        .finally(() => {
          if (autoSaveInFlightSignatureRef.current === signature) {
            autoSaveInFlightSignatureRef.current = "";
          }
        });
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [payload]);

  const handleSubmit = useCallback(() => {
    onSubmit(payload, draftPostId);
  }, [draftPostId, onSubmit, payload]);

  const handleAiGenerate = useCallback(
    async (nextMode: MobileAiMode) => {
      if (!content.trim()) {
        setAiError("AIに渡す本文を入力してください。");
        return;
      }

      setAiMode(nextMode);
      setAiError("");
      setAiStatusMessage("");

      const titleAtRequest = titleRef.current;
      const tagsAtRequest = tagsRef.current;

      try {
        const result = await onGenerateAi(content, nextMode);

        if (nextMode === "title") {
          if (titleRef.current === titleAtRequest) {
            titleRef.current = result;
            setTitle(result);
            setAiStatusMessage("タイトルを反映しました");
          } else {
            setAiStatusMessage("入力中のタイトルを優先しました");
          }
          return;
        }

        if (nextMode === "tags") {
          if (tagsRef.current === tagsAtRequest) {
            tagsRef.current = result;
            setTags(result);
            setAiStatusMessage("タグを反映しました");
          } else {
            setAiStatusMessage("入力中のタグを優先しました");
          }
          return;
        }

        const heading =
          nextMode === "rewrite" || nextMode === "improve"
            ? "AIによるリライト"
            : nextMode === "ideas"
              ? "AIによるアイデア"
              : "AIによる要約";

        setContent((currentContent) =>
          appendAiSection(currentContent, result, heading),
        );
        setAiStatusMessage("本文に追加しました");
      } catch (caughtError) {
        setAiError(
          caughtError instanceof Error
            ? caughtError.message
            : "AI生成に失敗しました。",
        );
      } finally {
        setAiMode(null);
      }
    },
    [content, onGenerateAi],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.editorTopbar}>
          <View style={styles.editorHeading}>
            <Text style={styles.kicker}>Memo editor</Text>
            <Text style={styles.title}>
              {mode === "create" ? "新規作成" : "メモ編集"}
            </Text>
          </View>
          <View style={styles.publishPill}>
            <Switch
              disabled={saving}
              onValueChange={setPublished}
              value={published}
            />
            <Text style={styles.publishPillText}>
              {published ? "公開" : "非公開"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.autoSaveStatus,
            autoSaveStatus === "error" ? styles.autoSaveStatusError : undefined,
          ]}
        >
          <Text
            style={[
              styles.autoSaveStatusText,
              autoSaveStatus === "saving"
                ? styles.autoSaveStatusTextSaving
                : undefined,
              autoSaveStatus === "saved"
                ? styles.autoSaveStatusTextSaved
                : undefined,
              autoSaveStatus === "error"
                ? styles.autoSaveStatusTextError
                : undefined,
            ]}
          >
            {getAutoSaveStatusText(autoSaveStatus)}
          </Text>
        </View>

        <Card style={[styles.aiPanel, styles.flatSurface]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAiOpen((current) => !current)}
            style={({ pressed }) => [
              styles.aiPanelHeader,
              pressed ? styles.buttonPressed : undefined,
            ]}
          >
            <View style={styles.editorHeading}>
              <Text style={styles.aiPanelKicker}>AI Assistant</Text>
              <Text style={styles.aiPanelLead}>
                {aiOpen
                  ? "タイトル・タグ・要約・リライトを生成できます。"
                  : "タップしてAI機能を開く"}
              </Text>
            </View>
            <View style={styles.aiHeaderRight}>
              {aiMode ? (
                <ActivityIndicator color={colors.primaryStrong} />
              ) : (
                <Text style={styles.aiToggleText}>{aiOpen ? "閉じる" : "開く"}</Text>
              )}
            </View>
          </Pressable>

          {aiOpen ? (
            <>
              <View style={styles.aiButtonRow}>
                {aiTasks.map((task) => (
                  <Button
                    disabled={Boolean(aiMode)}
                    key={task.mode}
                    onPress={() => {
                      void handleAiGenerate(task.mode);
                    }}
                    style={styles.aiTaskButton}
                    variant="soft"
                  >
                    {aiMode === task.mode ? "生成中..." : task.label}
                  </Button>
                ))}
              </View>

              {aiStatusMessage ? (
                <Text style={styles.aiSuccessText}>{aiStatusMessage}</Text>
              ) : null}
              {aiError ? <Text style={styles.aiErrorText}>{aiError}</Text> : null}
            </>
          ) : null}
        </Card>

        <Card style={styles.editorSheet}>
          <TextInput
            editable={!saving}
            onChangeText={setTitle}
            placeholder="タイトル"
            placeholderTextColor="#a0a8b5"
            style={styles.editorTitleInput}
            value={title}
          />

          <View style={styles.editorToolbar}>
            <Text style={styles.editorToolbarText}>本文</Text>
          </View>

          <TodoListEditor
            editable={!saving}
            onChange={setContent}
            value={content}
          />

          <TextInput
            autoCapitalize="none"
            editable={!saving}
            onChangeText={setTags}
            placeholder="タグ: React, 勉強, アイデア"
            placeholderTextColor="#a0a8b5"
            style={styles.editorTagsInput}
            value={tags}
          />
        </Card>

        {error ? <Text style={styles.formError}>{error}</Text> : null}
        {autoSaveError && autoSaveStatus === "error" ? (
          <Text style={styles.formError}>{autoSaveError}</Text>
        ) : null}

        <View style={styles.formActions}>
          <Button
            disabled={saving}
            onPress={onCancel}
            style={styles.formActionButton}
            variant="secondary"
          >
            キャンセル
          </Button>
          <Button
            disabled={saving}
            loading={saving}
            onPress={handleSubmit}
            style={styles.formActionButton}
            variant="dark"
          >
            {published ? "公開して保存" : "非公開で保存"}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [restoringToken, setRestoringToken] = useState(true);
  const [authViewMode, setAuthViewMode] = useState<AuthViewMode>("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [posts, setPosts] = useState<MobilePost[]>([]);
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated-desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedPost, setSelectedPost] = useState<MobilePost | null>(null);
  const [copied, setCopied] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [formError, setFormError] = useState("");
  const [autoSaveError, setAutoSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [accountDeleteLoading, setAccountDeleteLoading] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState("");

  const clearSession = useCallback(async (nextLoginError = "") => {
    await deleteStoredAccessToken();
    setAccessToken(null);
    setPosts([]);
    setQuery("");
    setSelectedFilter("all");
    setSortMode("updated-desc");
    setFiltersOpen(false);
    setSelectedPost(null);
    setCopied(false);
    setViewMode("list");
    setError("");
    setErrorStatus(null);
    setDetailError("");
    setFormError("");
    setAutoSaveError("");
    setAccountDeleteError("");
    setPassword("");
    setLoginError(nextLoginError);
    setAuthViewMode(nextLoginError ? "login" : "landing");
  }, []);

  const handleAuthError = useCallback(
    async (caughtError: unknown) => {
      if (
        caughtError instanceof MobileApiRequestError &&
        caughtError.status === 401
      ) {
        await clearSession("ログインが必要です。再度ログインしてください。");
        return true;
      }

      return false;
    },
    [clearSession],
  );

  const loadPosts = useCallback(
    async (token: string, nextRefreshing = false) => {
      if (nextRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setErrorStatus(null);

      try {
        const nextPosts = await fetchMobilePosts(token);
        setPosts(nextPosts);
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setErrorStatus(
          caughtError instanceof MobileApiRequestError
            ? (caughtError.status ?? null)
            : null,
        );
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "メモ一覧の取得に失敗しました。",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [handleAuthError],
  );

  useEffect(() => {
    let active = true;

    async function restoreToken() {
      try {
        const storedToken = await getStoredAccessToken();

        if (active) {
          setAccessToken(storedToken);
        }
      } catch {
        if (active) {
          setLoginError("保存済みログイン情報の読み込みに失敗しました。");
          setAuthViewMode("login");
        }
      } finally {
        if (active) {
          setRestoringToken(false);
        }
      }
    }

    restoreToken();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    loadPosts(accessToken);
  }, [accessToken, loadPosts]);

  const handleLogin = useCallback(async () => {
    const nextEmail = email.trim();

    if (!nextEmail || !password) {
      setLoginError("メールアドレスとパスワードを入力してください。");
      return;
    }

    setLoginLoading(true);
    setLoginError("");

    try {
      const result = await loginWithEmailPassword(nextEmail, password);
      await saveAccessToken(result.accessToken);
      setAccessToken(result.accessToken);
      setAuthViewMode("landing");
      setPassword("");
    } catch (caughtError) {
      setLoginError(
        caughtError instanceof Error
          ? caughtError.message
          : "ログインに失敗しました。",
      );
    } finally {
      setLoginLoading(false);
    }
  }, [email, password]);

  const handleRefresh = useCallback(() => {
    if (!accessToken) {
      setLoginError("ログインが必要です。");
      return;
    }

    loadPosts(accessToken, true);
  }, [accessToken, loadPosts]);

  const handleLogout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const performDeleteAccount = useCallback(async () => {
    if (!accessToken) {
      setLoginError("ログインが必要です。");
      return;
    }

    setAccountDeleteLoading(true);
    setAccountDeleteError("");

    try {
      await deleteMobileAccount(accessToken);
      await clearSession();
    } catch (caughtError) {
      if (await handleAuthError(caughtError)) {
        return;
      }

      setAccountDeleteError(
        caughtError instanceof Error
          ? caughtError.message
          : "アカウント削除に失敗しました。",
      );
    } finally {
      setAccountDeleteLoading(false);
    }
  }, [accessToken, clearSession, handleAuthError]);

  const confirmDeleteAccount = useCallback(() => {
    Alert.alert(
      "アカウントを削除しますか？",
      "この操作は取り消せません。アカウント、ログイン連携、セッション、作成したメモが削除されます。",
      [
        {
          style: "cancel",
          text: "キャンセル",
        },
        {
          onPress: () => {
            Alert.alert(
              "本当に削除しますか？",
              "削除後はログアウトされ、ログイン前の画面に戻ります。",
              [
                {
                  style: "cancel",
                  text: "戻る",
                },
                {
                  onPress: () => {
                    void performDeleteAccount();
                  },
                  style: "destructive",
                  text: "本当に削除する",
                },
              ],
            );
          },
          style: "destructive",
          text: "アカウントを削除",
        },
      ],
    );
  }, [performDeleteAccount]);

  const openRegisterPage = useCallback(() => {
    if (!API_BASE_URL) {
      Alert.alert(
        "新規登録ページを開けません",
        "EXPO_PUBLIC_API_BASE_URL が設定されていません。",
      );
      return;
    }

    void Linking.openURL(`${API_BASE_URL}/register`);
  }, []);

  const openPostDetail = useCallback(
    async (post: MobilePost) => {
      if (!accessToken) {
        setLoginError("ログインが必要です。");
        return;
      }

      setSelectedPost(post);
      setCopied(false);
      setViewMode("detail");
      setDetailLoading(true);
      setDetailError("");

      try {
        const latestPost = await fetchMobilePost(accessToken, post.id);
        setSelectedPost(latestPost);
        setPosts((currentPosts) =>
          currentPosts.map((currentPost) =>
            currentPost.id === latestPost.id ? latestPost : currentPost,
          ),
        );
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setDetailError(
          caughtError instanceof Error
            ? caughtError.message
            : "メモ詳細の取得に失敗しました。",
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [accessToken, handleAuthError],
  );

  const handleCreate = useCallback(() => {
    setSelectedPost(null);
    setFormError("");
    setAutoSaveError("");
    setViewMode("create");
  }, []);

  const handleEdit = useCallback(() => {
    setFormError("");
    setAutoSaveError("");
    setViewMode("edit");
  }, []);

  const copySelectedPost = useCallback(async () => {
    if (!selectedPost) {
      return;
    }

    await Clipboard.setStringAsync(getFormattedCopyContent(selectedPost));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [selectedPost]);

  const handleCancelForm = useCallback(() => {
    setFormError("");
    setAutoSaveError("");
    setViewMode(selectedPost ? "detail" : "list");
  }, [selectedPost]);

  const validatePayload = useCallback((payload: MobilePostPayload) => {
    if (!payload.title.trim()) {
      return "タイトルを入力してください。";
    }

    if (!payload.content.trim()) {
      return "本文を入力してください。";
    }

    return "";
  }, []);

  const handleSaveCreate = useCallback(
    async (payload: MobilePostPayload, draftPostId: number | null) => {
      if (!accessToken) {
        setLoginError("ログインが必要です。");
        return;
      }

      const validationError = validatePayload(payload);

      if (validationError) {
        setFormError(validationError);
        return;
      }

      setSaving(true);
      setFormError("");

      try {
        const savedPost = draftPostId
          ? await updateMobilePost(accessToken, draftPostId, payload)
          : await createMobilePost(accessToken, payload);

        setPosts((currentPosts) => {
          const exists = currentPosts.some(
            (currentPost) => currentPost.id === savedPost.id,
          );

          return exists
            ? currentPosts.map((currentPost) =>
                currentPost.id === savedPost.id ? savedPost : currentPost,
              )
            : [savedPost, ...currentPosts];
        });
        setSelectedPost(savedPost);
        setViewMode("detail");
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setFormError(
          caughtError instanceof Error
            ? caughtError.message
            : "メモの作成に失敗しました。",
        );
      } finally {
        setSaving(false);
      }
    },
    [accessToken, handleAuthError, validatePayload],
  );

  const handleSaveEdit = useCallback(
    async (payload: MobilePostPayload, draftPostId: number | null) => {
      const postId = draftPostId ?? selectedPost?.id ?? null;

      if (!accessToken || !postId) {
        setLoginError("ログインが必要です。");
        return;
      }

      const validationError = validatePayload(payload);

      if (validationError) {
        setFormError(validationError);
        return;
      }

      setSaving(true);
      setFormError("");

      try {
        const updatedPost = await updateMobilePost(
          accessToken,
          postId,
          payload,
        );
        setPosts((currentPosts) =>
          currentPosts.map((currentPost) =>
            currentPost.id === updatedPost.id ? updatedPost : currentPost,
          ),
        );
        setSelectedPost(updatedPost);
        setViewMode("detail");
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setFormError(
          caughtError instanceof Error
            ? caughtError.message
            : "メモの更新に失敗しました。",
        );
      } finally {
        setSaving(false);
      }
    },
    [accessToken, handleAuthError, selectedPost, validatePayload],
  );

  const handleAutoSave = useCallback(
    async (payload: MobilePostPayload, draftPostId: number | null) => {
      const postId = draftPostId ?? selectedPost?.id ?? null;

      if (!accessToken) {
        setAutoSaveError("ログインが必要です。");
        throw new Error("ログインが必要です。");
      }

      if (!canAutoSavePayload(payload)) {
        throw new Error("自動保存できる入力内容ではありません。");
      }

      if (viewMode !== "create" && !postId) {
        setAutoSaveError("保存対象のメモが見つかりません。");
        throw new Error("保存対象のメモが見つかりません。");
      }

      setAutoSaveError("");

      try {
        const savedPost =
          modeForAutoSave(viewMode, postId) === "create"
            ? await createMobilePost(accessToken, payload)
            : await updateMobilePost(accessToken, postId as number, payload);

        setPosts((currentPosts) => {
          const exists = currentPosts.some(
            (currentPost) => currentPost.id === savedPost.id,
          );

          return exists
            ? currentPosts.map((currentPost) =>
                currentPost.id === savedPost.id ? savedPost : currentPost,
              )
            : [savedPost, ...currentPosts];
        });
        setSelectedPost(savedPost);

        return savedPost;
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          setAutoSaveError("ログインが必要です。再度ログインしてください。");
        } else {
          setAutoSaveError(
            caughtError instanceof Error
              ? caughtError.message
              : "自動保存に失敗しました。",
          );
        }

        throw caughtError;
      }
    },
    [accessToken, handleAuthError, selectedPost, viewMode],
  );

  const handleGenerateAi = useCallback(
    async (content: string, mode: MobileAiMode) => {
      if (!accessToken) {
        setLoginError("ログインが必要です。");
        throw new Error("ログインが必要です。");
      }

      try {
        return await generateMobileAiContent(accessToken, content, mode);
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          throw new Error("ログインが必要です。再度ログインしてください。");
        }

        throw caughtError;
      }
    },
    [accessToken, handleAuthError],
  );

  const performDelete = useCallback(async () => {
    if (!accessToken || !selectedPost) {
      setLoginError("ログインが必要です。");
      return;
    }

    setDeleting(true);
    setDetailError("");

    try {
      await deleteMobilePost(accessToken, selectedPost.id);
      setPosts((currentPosts) =>
        currentPosts.filter((currentPost) => currentPost.id !== selectedPost.id),
      );
      setSelectedPost(null);
      setViewMode("list");
    } catch (caughtError) {
      if (await handleAuthError(caughtError)) {
        return;
      }

      setDetailError(
        caughtError instanceof Error
          ? caughtError.message
          : "メモの削除に失敗しました。",
      );
    } finally {
      setDeleting(false);
    }
  }, [accessToken, handleAuthError, selectedPost]);

  const confirmDelete = useCallback(() => {
    Alert.alert("メモを削除しますか？", "削除したメモは元に戻せません。", [
      { style: "cancel", text: "キャンセル" },
      {
        onPress: () => {
          void performDelete();
        },
        style: "destructive",
        text: "削除",
      },
    ]);
  }, [performDelete]);

  const errorTitle =
    errorStatus === 401 ? "ログインが必要です" : "取得できませんでした";
  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return posts
      .filter((post) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          post.title.toLowerCase().includes(normalizedQuery) ||
          post.content.toLowerCase().includes(normalizedQuery) ||
          post.tags.some((tag) =>
            tag.name.toLowerCase().includes(normalizedQuery),
          );

        const matchesStatus =
          selectedFilter === "all" ||
          selectedFilter === "mine" ||
          (selectedFilter === "published" && post.published) ||
          (selectedFilter === "private" && !post.published);

        return matchesQuery && matchesStatus;
      })
      .sort((leftPost, rightPost) => {
        if (sortMode === "title-asc") {
          return leftPost.title.localeCompare(rightPost.title, "ja");
        }

        const left =
          sortMode === "created-desc" ? leftPost.createdAt : leftPost.updatedAt;
        const right =
          sortMode === "created-desc" ? rightPost.createdAt : rightPost.updatedAt;

        return new Date(right).getTime() - new Date(left).getTime();
      });
  }, [posts, query, selectedFilter, sortMode]);
  const publishedCount = posts.filter((post) => post.published).length;
  const privateCount = posts.filter((post) => !post.published).length;
  const selectedFilterLabel =
    statusFilters.find((filter) => filter.value === selectedFilter)?.label ??
    "すべて";
  const selectedSortLabel =
    sortOptions.find((option) => option.value === sortMode)?.label ?? "更新日";

  if (restoringToken) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centerState}>
          <ActivityIndicator color="#2563eb" size="large" />
          <Text style={styles.stateText}>ログイン状態を確認しています</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!accessToken) {
    if (authViewMode === "landing") {
      return (
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" />
          <HomeLanding
            onLoginPress={() => setAuthViewMode("login")}
            onRegisterPress={openRegisterPage}
          />
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
          style={styles.loginScreen}
        >
          <ScrollView
            contentContainerStyle={styles.loginScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Card style={[styles.loginPanel, styles.flatSurface]}>
              <Button
                onPress={() => setAuthViewMode("landing")}
                style={styles.backToLandingButton}
                variant="secondary"
              >
                概要に戻る
              </Button>

              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>M</Text>
                </View>
                <Text style={styles.brandText}>My Memo App</Text>
              </View>
              <View style={styles.loginHeading}>
                <Text style={styles.kicker}>Welcome back</Text>
                <Text style={styles.loginTitle}>ログイン</Text>
                <Text style={styles.loginLead}>
                  メールアドレスで続行して、あなたのメモ一覧へすぐに進めます。
                </Text>
              </View>

              <View style={styles.loginForm}>
                <TextField
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  editable={!loginLoading}
                  inputMode="email"
                  label="メールアドレス"
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  textContentType="emailAddress"
                  value={email}
                />

                <TextField
                  autoCapitalize="none"
                  autoComplete="current-password"
                  editable={!loginLoading}
                  label="パスワード"
                  onChangeText={setPassword}
                  placeholder="8文字以上"
                  secureTextEntry
                  textContentType="password"
                  value={password}
                />
              </View>

              {loginError ? (
                <Text style={styles.loginError}>{loginError}</Text>
              ) : null}

              <Button
                loading={loginLoading}
                onPress={handleLogin}
                style={styles.fullButton}
              >
                メールアドレスでログイン
              </Button>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (viewMode === "create") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <MemoForm
          autoSaveError={autoSaveError}
          error={formError}
          key="create"
          mode="create"
          onAutoSave={handleAutoSave}
          onCancel={handleCancelForm}
          onGenerateAi={handleGenerateAi}
          onSubmit={(payload, draftPostId) => {
            void handleSaveCreate(payload, draftPostId);
          }}
          saving={saving}
        />
      </SafeAreaView>
    );
  }

  if (viewMode === "account") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.accountSettingsContent}>
          <View style={styles.accountSettingsTopBar}>
            <Button
              onPress={() => {
                setAccountDeleteError("");
                setViewMode("list");
              }}
              style={styles.toolButton}
              variant="secondary"
            >
              戻る
            </Button>
          </View>

          <View style={styles.accountSettingsHeader}>
            <Text style={styles.kicker}>Account</Text>
            <Text style={styles.title}>アカウント設定</Text>
            <Text style={styles.accountSettingsLead}>
              ログアウトやアカウント削除など、メモ操作とは別の設定を管理します。
            </Text>
          </View>

          <Card style={[styles.accountSettingsCard, styles.flatSurface]}>
            <Text style={styles.accountSettingsSectionTitle}>セッション</Text>
            <Text style={styles.accountSettingsText}>
              この端末に保存されたログイン情報を削除してログアウトします。
            </Text>
            <Button
              onPress={handleLogout}
              style={styles.fullButton}
              variant="secondary"
            >
              ログアウト
            </Button>
          </Card>

          <Card
            style={[
              styles.accountSettingsCard,
              styles.accountSettingsDangerCard,
              styles.flatSurface,
            ]}
          >
            <Text style={styles.accountDeletionKicker}>Danger zone</Text>
            <Text style={styles.accountSettingsSectionTitle}>
              アカウント削除
            </Text>
            <Text style={styles.accountSettingsText}>
              アカウント、ログイン連携、セッション、作成したメモを削除します。
            </Text>
            {accountDeleteError ? (
              <Text style={styles.accountDeletionError}>
                {accountDeleteError}
              </Text>
            ) : null}
            <Button
              disabled={accountDeleteLoading}
              loading={accountDeleteLoading}
              onPress={confirmDeleteAccount}
              style={styles.fullButton}
              variant="danger"
            >
              アカウントを削除
            </Button>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (viewMode === "edit" && selectedPost) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <MemoForm
          autoSaveError={autoSaveError}
          error={formError}
          initialPost={selectedPost}
          key={`edit-${selectedPost.id}`}
          mode="edit"
          onAutoSave={handleAutoSave}
          onCancel={handleCancelForm}
          onGenerateAi={handleGenerateAi}
          onSubmit={(payload, draftPostId) => {
            void handleSaveEdit(payload, draftPostId);
          }}
          saving={saving}
        />
      </SafeAreaView>
    );
  }

  if (viewMode === "detail") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.detailContent}>
          <View style={styles.detailTopBar}>
            <Button
              onPress={() => setViewMode("list")}
              style={styles.toolButton}
              variant="secondary"
            >
              戻る
            </Button>
            <View style={styles.detailActions}>
              <Button
                disabled={!selectedPost}
                onPress={() => {
                  void copySelectedPost();
                }}
                style={styles.toolButton}
                variant="secondary"
              >
                {copied ? "コピー済み" : "コピー"}
              </Button>
              <Button
                disabled={!selectedPost || detailLoading || deleting}
                onPress={handleEdit}
                style={styles.toolButton}
                variant="secondary"
              >
                編集
              </Button>
              <Button
                disabled={!selectedPost || detailLoading || deleting}
                loading={deleting}
                onPress={confirmDelete}
                style={styles.toolButton}
                variant="danger"
              >
                削除
              </Button>
            </View>
          </View>

          {detailLoading && !selectedPost ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#2563eb" size="large" />
              <Text style={styles.stateText}>メモを読み込んでいます</Text>
            </View>
          ) : selectedPost ? (
            <Card style={styles.articleCard}>
              <View style={styles.articleHeader}>
                <View style={styles.articleTitleRow}>
                  <Text style={styles.detailTitle}>{selectedPost.title}</Text>
                  <Badge variant={selectedPost.published ? "public" : "default"}>
                    {selectedPost.published ? "公開" : "非公開"}
                  </Badge>
                </View>

                <View style={styles.postMetaGrid}>
                  <View style={styles.postMetaItem}>
                    <Text style={styles.postMetaLabel}>作成</Text>
                    <Text style={styles.postMetaValue}>
                      {formatUpdatedAt(selectedPost.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.postMetaItem}>
                    <Text style={styles.postMetaLabel}>更新</Text>
                    <Text style={styles.postMetaValue}>
                      {formatUpdatedAt(selectedPost.updatedAt)}
                    </Text>
                  </View>
                  <View style={styles.postMetaItem}>
                    <Text style={styles.postMetaLabel}>カテゴリー</Text>
                    <Text style={styles.postMetaValue}>
                      {selectedPost.tags.length > 0
                        ? selectedPost.tags.map((tag) => tag.name).join(" / ")
                        : "未分類"}
                    </Text>
                  </View>
                </View>
              </View>

              {detailLoading ? (
                <Text style={styles.inlineLoading}>最新状態を確認中...</Text>
              ) : null}

              {detailError ? (
                <Text style={styles.formError}>{detailError}</Text>
              ) : null}
              {copied ? (
                <Text style={styles.copyFeedback}>コピーしました</Text>
              ) : null}

              <TodoContentDisplay content={selectedPost.content} />

              <View style={[styles.tagRow, styles.detailTagRow]}>
                {selectedPost.tags.length > 0 ? (
                  selectedPost.tags.map((tag) => (
                    <Badge key={tag.id} variant="tag">
                      #{tag.name}
                    </Badge>
                  ))
                ) : (
                  <Text style={styles.noTags}>タグなし</Text>
                )}
              </View>
            </Card>
          ) : (
            <View style={styles.centerState}>
              <Text style={styles.errorTitle}>メモがありません</Text>
              <Text style={styles.errorText}>
                一覧に戻って再度選択してください。
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Memo workspace</Text>
            <Text style={styles.title}>メモ一覧</Text>
            <Text style={styles.postsSummary}>
              {posts.length}件のメモ / 公開 {publishedCount}件 / 非公開 {privateCount}件
            </Text>
          </View>
        </View>

        <Card style={styles.listToolbar}>
          <Button
            onPress={handleCreate}
            style={styles.toolbarButton}
          >
            新規作成
          </Button>
          <Button
            onPress={handleRefresh}
            style={styles.toolbarButton}
            variant="secondary"
          >
            更新
          </Button>
          <Button
            onPress={() => {
              setAccountDeleteError("");
              setViewMode("account");
            }}
            style={styles.toolbarButton}
            variant="secondary"
          >
            アカウント
          </Button>
        </Card>

        <Card style={[styles.postsControls, styles.flatSurface]}>
          <View style={styles.searchCompactRow}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="タイトル、本文、タグで検索"
              placeholderTextColor="#a0a8b5"
              style={styles.searchInputCompact}
              value={query}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setFiltersOpen((current) => !current)}
              style={({ pressed }) => [
                styles.filterToggle,
                pressed ? styles.buttonPressed : undefined,
              ]}
            >
              <Text style={styles.filterToggleText}>
                {filtersOpen ? "閉じる" : "絞り込み"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.activeFilterRow}>
            <Text style={styles.activeFilterChip}>表示: {selectedFilterLabel}</Text>
            <Text style={styles.activeFilterChip}>並び替え: {selectedSortLabel}</Text>
          </View>

          {filtersOpen ? (
            <View style={styles.compactFilters}>
              <View style={styles.controlGroup}>
                <Text style={styles.controlLabel}>表示</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterChipScroll}
                >
                  {statusFilters.map((filter) => (
                    <Pressable
                      accessibilityRole="button"
                      key={filter.value}
                      onPress={() => setSelectedFilter(filter.value)}
                      style={[
                        styles.filterChip,
                        selectedFilter === filter.value
                          ? styles.filterChipActive
                          : undefined,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedFilter === filter.value
                            ? styles.filterChipTextActive
                            : undefined,
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.controlGroup}>
                <Text style={styles.controlLabel}>並び替え</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterChipScroll}
                >
                  {sortOptions.map((option) => (
                    <Pressable
                      accessibilityRole="button"
                      key={option.value}
                      onPress={() => setSortMode(option.value)}
                      style={[
                        styles.filterChip,
                        sortMode === option.value
                          ? styles.filterChipActive
                          : undefined,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          sortMode === option.value
                            ? styles.filterChipTextActive
                            : undefined,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          ) : null}
        </Card>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#2563eb" size="large" />
            <Text style={styles.stateText}>メモを読み込んでいます</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorTitle}>{errorTitle}</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              onPress={() => loadPosts(accessToken)}
              style={styles.retryButton}
              variant="secondary"
            >
              再試行
            </Button>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyTitle}>メモはまだありません</Text>
            <Text style={styles.emptyText}>
              新規ボタンから最初のメモを作成できます。
            </Text>
          </View>
        ) : filteredPosts.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyTitle}>該当するメモが見つかりませんでした</Text>
            <Text style={styles.emptyText}>
              検索キーワードや公開ステータスを変えると、別のメモが見つかるかもしれません。
            </Text>
            <Button
              onPress={() => {
                setQuery("");
                setSelectedFilter("all");
                setSortMode("updated-desc");
                setFiltersOpen(false);
              }}
              style={styles.retryButton}
              variant="secondary"
            >
              条件をリセット
            </Button>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={filteredPosts}
            keyExtractor={(item) => String(item.id)}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            renderItem={({ item }) => (
              <PostCard
                onPress={() => {
                  void openPostDetail(item);
                }}
                post={item}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
  },
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 22,
  },
  loginScreen: {
    flex: 1,
  },
  loginPanel: {
    backgroundColor: colors.surface,
    padding: 24,
  },
  flatSurface: {
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  loginScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 28,
  },
  landingContent: {
    paddingBottom: 42,
    paddingHorizontal: spacing.lg,
    paddingTop: 34,
  },
  heroCopy: {
    marginTop: 8,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 46,
    marginTop: 12,
  },
  heroLead: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 30,
    marginTop: 22,
  },
  heroActions: {
    gap: 12,
    marginTop: 30,
  },
  heroActionButton: {
    minHeight: 50,
    width: "100%",
  },
  heroStats: {
    backgroundColor: "rgba(255, 255, 255, 0.58)",
    marginTop: 36,
  },
  heroStatItem: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    padding: 18,
  },
  heroStatItemLast: {
    borderBottomWidth: 0,
  },
  heroStatTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  heroStatText: {
    color: colors.textSoft,
    fontSize: 14,
    marginTop: 4,
  },
  featureGrid: {
    gap: 16,
    marginTop: 42,
  },
  featureCard: {
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: radius.md,
    minHeight: 142,
    padding: 22,
  },
  featureTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
  },
  featureText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 27,
    marginTop: 10,
  },
  backToLandingButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 26,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: "rgba(37, 99, 235, 0.24)",
    borderRadius: radius.md,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  brandMarkText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  brandText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  loginHeading: {
    marginBottom: 24,
  },
  loginTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    marginTop: 6,
  },
  loginLead: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  formContent: {
    paddingHorizontal: 10,
    paddingBottom: 96,
    paddingTop: 22,
  },
  fullButton: {
    width: "100%",
  },
  loginForm: {
    gap: 14,
    marginBottom: 14,
  },
  loginError: {
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(220, 38, 38, 0.2)",
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
    padding: 10,
  },
  formError: {
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(220, 38, 38, 0.2)",
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
    padding: 12,
  },
  header: {
    marginBottom: spacing.md,
  },
  kicker: {
    ...typography.eyebrow,
  },
  title: {
    ...typography.screenTitle,
    marginTop: 6,
  },
  postsSummary: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  listToolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
    padding: 10,
  },
  postsControls: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: radius.md,
    gap: 8,
    marginBottom: 12,
    padding: 10,
  },
  searchCompactRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  searchInputCompact: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  filterToggle: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12,
  },
  filterToggleText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  activeFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  activeFilterChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  compactFilters: {
    gap: 10,
    paddingTop: 4,
  },
  controlGroup: {
    gap: 7,
  },
  controlLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "900",
  },
  filterChipScroll: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 12,
  },
  filterChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
  },
  filterChipTextActive: {
    color: colors.white,
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  formActionButton: {
    flex: 1,
  },
  toolbarButton: {
    flexGrow: 1,
    minWidth: 96,
  },
  accountSettingsContent: {
    paddingBottom: 42,
    paddingHorizontal: spacing.lg,
    paddingTop: 22,
  },
  accountSettingsTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 20,
  },
  accountSettingsHeader: {
    marginBottom: 18,
  },
  accountSettingsLead: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 10,
  },
  accountSettingsCard: {
    backgroundColor: colors.surface,
    gap: 12,
    marginBottom: 12,
    padding: 18,
  },
  accountSettingsDangerCard: {
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(220, 38, 38, 0.16)",
  },
  accountSettingsSectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  accountSettingsText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },
  accountDeletionKicker: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  accountDeletionError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
  },
  toolButton: {
    minWidth: 72,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  stateText: {
    color: "#475569",
    fontSize: 15,
    marginTop: 14,
  },
  errorTitle: {
    color: "#991b1b",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#7f1d1d",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 32,
  },
  memoCard: {
    marginBottom: 12,
    minHeight: 224,
  },
  memoCardMain: {
    flex: 1,
    padding: 18,
  },
  cardBadgeRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    minHeight: 28,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
    marginTop: 10,
  },
  cardContent: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 12,
  },
  cardContentPreview: {
    gap: 5,
    marginTop: 12,
  },
  cardContentPreviewText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  cardTodoPreviewLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 7,
    minHeight: 22,
  },
  cardTodoCheckbox: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: 4,
    borderWidth: 1,
    height: 16,
    justifyContent: "center",
    marginTop: 3,
    width: 16,
  },
  cardTodoCheckboxMark: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 13,
  },
  cardTodoPreviewText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  noTags: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  memoDates: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: "auto",
    paddingTop: 14,
  },
  memoDateItem: {
    flex: 1,
    gap: 2,
  },
  memoDateLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "900",
  },
  memoDateValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  detailContent: {
    paddingHorizontal: 10,
    paddingBottom: 108,
    paddingTop: 28,
  },
  detailTopBar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    marginBottom: 18,
    padding: 8,
  },
  detailActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  articleCard: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 34,
    paddingBottom: 30,
  },
  articleHeader: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
  },
  articleTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  detailTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  detailBody: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 30,
    minHeight: 180,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 34,
  },
  postMetaGrid: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 22,
    paddingTop: 18,
  },
  postMetaItem: {
    minWidth: "45%",
    gap: 4,
  },
  postMetaLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "900",
  },
  postMetaValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  inlineLoading: {
    color: colors.primaryStrong,
    fontSize: 13,
    marginBottom: 10,
    paddingHorizontal: 22,
  },
  copyFeedback: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 10,
    paddingHorizontal: 22,
  },
  todoContent: {
    gap: 8,
    minHeight: 180,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 34,
  },
  todoParagraph: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 30,
  },
  todoLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    minHeight: 32,
  },
  todoLineChecked: {
    opacity: 0.72,
  },
  todoCheckbox: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: 4,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    marginTop: 5,
    width: 20,
  },
  todoCheckboxChecked: {
    backgroundColor: "rgba(15, 118, 110, 0.12)",
    borderColor: colors.accent,
  },
  todoCheckboxMark: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16,
  },
  todoText: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    lineHeight: 30,
  },
  todoTextChecked: {
    color: colors.textSoft,
    textDecorationLine: "line-through",
  },
  editorTopbar: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    marginBottom: 18,
  },
  editorHeading: {
    flex: 1,
  },
  autoSaveStatus: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 28,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  autoSaveStatusError: {
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(220, 38, 38, 0.2)",
  },
  autoSaveStatusText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "900",
  },
  autoSaveStatusTextError: {
    color: colors.danger,
  },
  autoSaveStatusTextSaved: {
    color: colors.accent,
  },
  autoSaveStatusTextSaving: {
    color: colors.primaryStrong,
  },
  aiPanel: {
    backgroundColor: "rgba(219, 234, 254, 0.28)",
    borderColor: "rgba(37, 99, 235, 0.12)",
    borderRadius: radius.md,
    marginBottom: 12,
    padding: 0,
  },
  aiPanelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  aiPanelKicker: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  aiPanelLead: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
  },
  aiHeaderRight: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 48,
  },
  aiToggleText: {
    color: colors.primaryStrong,
    fontSize: 13,
    fontWeight: "900",
  },
  aiButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  aiTaskButton: {
    flexGrow: 1,
    minWidth: 92,
  },
  aiSuccessText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 20,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  aiErrorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  publishPill: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  publishPillText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
  },
  editorSheet: {
    marginBottom: 18,
  },
  editorTitleInput: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 38,
    minHeight: 92,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 14,
  },
  editorToolbar: {
    backgroundColor: "rgba(248, 250, 252, 0.82)",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  editorToolbarText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  todoEditor: {
    minHeight: 360,
    paddingBottom: 28,
  },
  todoEditorToolbar: {
    backgroundColor: "rgba(240, 253, 250, 0.58)",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  todoToolbarButton: {
    flexGrow: 1,
    minHeight: 38,
    minWidth: 132,
  },
  todoEditorLines: {
    gap: 2,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  todoEditorLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingVertical: 2,
  },
  todoEditorLineChecked: {
    opacity: 0.74,
  },
  todoCheckButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 28,
  },
  todoTextSpacer: {
    width: 28,
  },
  todoEditorInput: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    lineHeight: 30,
    minHeight: 40,
    paddingHorizontal: 0,
    paddingTop: 5,
    paddingBottom: 5,
  },
  editorTagsInput: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    color: colors.textMuted,
    fontSize: 15,
    minHeight: 58,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  detailTagRow: {
    paddingHorizontal: 22,
    paddingTop: 4,
  },
});
