import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { loginWithEmailPassword } from "./src/api/auth";
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
import { colors, radius, shadows, spacing, typography } from "./src/theme";
import type { MobileAiMode, MobilePost, MobilePostPayload } from "./src/types/posts";

type ViewMode = "list" | "detail" | "create" | "edit";
type AuthViewMode = "landing" | "login";
type AutoSaveStatus = "unsaved" | "saving" | "saved" | "error";

const AUTO_SAVE_DEBOUNCE_MS = 1500;

const aiTasks: { label: string; mode: MobileAiMode }[] = [
  { label: "要約", mode: "summarize" },
  { label: "リライト", mode: "improve" },
  { label: "アイデア", mode: "ideas" },
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

function getPreview(content: string) {
  const normalized = content.trim();

  if (!normalized) {
    return "本文はまだありません。";
  }

  return normalized.length > 120
    ? `${normalized.slice(0, 120).trimEnd()}...`
    : normalized;
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

function canAutoSavePayload(payload: MobilePostPayload) {
  return Boolean(payload.title.trim() && payload.content.trim());
}

function getAutoSaveStatusText(status: AutoSaveStatus) {
  if (status === "saving") return "保存中...";
  if (status === "saved") return "保存済み";
  if (status === "error") return "保存失敗";
  return "未保存";
}

function getAiResultHeading(mode: MobileAiMode | null) {
  if (mode === "improve") return "AIによるリライト";
  if (mode === "ideas") return "AIによるアイデア";
  return "AIによる要約";
}

function getAppliedAiContent(
  currentContent: string,
  result: string,
  mode: MobileAiMode | null,
) {
  if (mode === "improve") {
    return result;
  }

  const heading = mode === "ideas" ? "AIによるアイデア" : "AIによる要約";
  return `${currentContent.trimEnd()}\n\n\n--- ${heading} ---\n${result}`.trimStart();
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

      <Card style={styles.heroStats}>
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
          <Card key={feature.title} style={styles.featureCard}>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureText}>{feature.description}</Text>
          </Card>
        ))}
      </View>
    </ScrollView>
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

          <Text style={styles.cardContent} numberOfLines={6}>
            {getPreview(post.content)}
          </Text>

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
  const [aiMode, setAiMode] = useState<MobileAiMode | null>(null);
  const [aiResult, setAiResult] = useState("");
  const [aiResultMode, setAiResultMode] = useState<MobileAiMode | null>(null);
  const [aiError, setAiError] = useState("");
  const [draftPostId, setDraftPostId] = useState<number | null>(
    initialPost?.id ?? null,
  );
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef(
    initialPost
      ? getPayloadSignature({
          content: initialPost.content,
          published: initialPost.published,
          tags: getTagsInput(initialPost),
          title: initialPost.title,
        })
      : "",
  );

  const payload = useMemo(
    () => ({
      content,
      published,
      tags,
      title,
    }),
    [content, published, tags, title],
  );

  useEffect(() => {
    const signature = getPayloadSignature(payload);

    if (signature === lastSavedSignatureRef.current) {
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
      setAutoSaveStatus("saving");

      onAutoSave(payload, draftPostId)
        .then((savedPost) => {
          const savedSignature = getPayloadSignature({
            content: savedPost.content,
            published: savedPost.published,
            tags: getTagsInput(savedPost),
            title: savedPost.title,
          });

          setDraftPostId(savedPost.id);
          lastSavedSignatureRef.current = savedSignature;
          setAutoSaveStatus("saved");
        })
        .catch(() => {
          setAutoSaveStatus("error");
        });
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [draftPostId, onAutoSave, payload]);

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

      try {
        const result = await onGenerateAi(content, nextMode);
        setAiResult(result);
        setAiResultMode(nextMode);
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

  const applyAiResult = useCallback(() => {
    if (!aiResult) {
      return;
    }

    setContent((currentContent) =>
      getAppliedAiContent(currentContent, aiResult, aiResultMode),
    );
  }, [aiResult, aiResultMode]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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

        <Card style={styles.aiPanel}>
          <View style={styles.aiPanelHeader}>
            <View style={styles.editorHeading}>
              <Text style={styles.aiPanelKicker}>AI Assistant</Text>
              <Text style={styles.aiPanelLead}>
                本文をもとに、要約・リライト・次のアイデアを生成できます。
              </Text>
            </View>
            {aiMode ? <ActivityIndicator color={colors.primaryStrong} /> : null}
          </View>

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

          {aiError ? <Text style={styles.aiErrorText}>{aiError}</Text> : null}

          {aiResult ? (
            <View style={styles.aiResultBox}>
              <Text style={styles.aiResultLabel}>
                {getAiResultHeading(aiResultMode)}
              </Text>
              <Text style={styles.aiResultText}>{aiResult}</Text>
              <Button
                onPress={applyAiResult}
                style={styles.aiApplyButton}
                variant={aiResultMode === "improve" ? "dark" : "secondary"}
              >
                {aiResultMode === "improve" ? "本文を置き換える" : "本文に追加"}
              </Button>
            </View>
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

          <TextInput
            editable={!saving}
            multiline
            onChangeText={setContent}
            placeholder="本文を書き始める"
            placeholderTextColor="#a0a8b5"
            style={styles.editorBodyInput}
            textAlignVertical="top"
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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedPost, setSelectedPost] = useState<MobilePost | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [formError, setFormError] = useState("");
  const [autoSaveError, setAutoSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const clearSession = useCallback(async (nextLoginError = "") => {
    await deleteStoredAccessToken();
    setAccessToken(null);
    setPosts([]);
    setSelectedPost(null);
    setViewMode("list");
    setError("");
    setErrorStatus(null);
    setDetailError("");
    setFormError("");
    setAutoSaveError("");
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
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.loginScreen}
        >
          <Card style={styles.loginPanel}>
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

              <Text style={styles.detailBody}>{selectedPost.content}</Text>

              <View style={styles.tagRow}>
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
              {posts.length}件のメモ
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
            onPress={handleLogout}
            style={styles.toolbarButton}
            variant="secondary"
          >
            ログアウト
          </Button>
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
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={posts}
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
    paddingTop: 28,
  },
  loginScreen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 28,
  },
  loginPanel: {
    backgroundColor: colors.surface,
    padding: 24,
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
    paddingBottom: 36,
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
    marginBottom: spacing.lg,
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
    marginBottom: 18,
    padding: 12,
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
    marginBottom: 14,
    minHeight: 250,
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
    paddingBottom: 36,
    paddingTop: 28,
  },
  detailTopBar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    padding: 8,
    ...shadows.soft,
  },
  detailActions: {
    flexDirection: "row",
    gap: 8,
  },
  articleCard: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
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
    paddingVertical: 24,
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
    backgroundColor: "rgba(219, 234, 254, 0.36)",
    borderColor: "rgba(37, 99, 235, 0.14)",
    marginBottom: 14,
    padding: 14,
  },
  aiPanelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
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
  aiButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  aiTaskButton: {
    flexGrow: 1,
    minWidth: 92,
  },
  aiErrorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 12,
  },
  aiResultBox: {
    backgroundColor: colors.surfaceStrong,
    borderColor: "rgba(37, 99, 235, 0.14)",
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  aiResultLabel: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  aiResultText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 26,
  },
  aiApplyButton: {
    marginTop: 12,
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
  editorBodyInput: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 30,
    minHeight: 300,
    paddingHorizontal: 22,
    paddingVertical: 20,
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
});
