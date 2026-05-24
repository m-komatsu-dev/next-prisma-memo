import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import type { MobilePost, MobilePostPayload } from "./src/types/posts";

type ViewMode = "list" | "detail" | "create" | "edit";

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
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.buttonPressed : undefined,
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{post.title}</Text>
        <View
          style={[
            styles.statusBadge,
            post.published ? styles.statusBadgePublic : undefined,
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              post.published ? styles.statusBadgeTextPublic : undefined,
            ]}
          >
            {post.published ? "公開" : "非公開"}
          </Text>
        </View>
      </View>

      <Text style={styles.cardContent} numberOfLines={4}>
        {getPreview(post.content)}
      </Text>

      <View style={styles.tagRow}>
        {post.tags.length > 0 ? (
          post.tags.map((tag) => (
            <View key={tag.id} style={styles.tag}>
              <Text style={styles.tagText}>#{tag.name}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noTags}>タグなし</Text>
        )}
      </View>

      <Text style={styles.updatedAt}>更新: {updatedAt}</Text>
    </Pressable>
  );
}

function MemoForm({
  error,
  initialPost,
  mode,
  onCancel,
  onSubmit,
  saving,
}: {
  error: string;
  initialPost?: MobilePost | null;
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (payload: MobilePostPayload) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [content, setContent] = useState(initialPost?.content ?? "");
  const [tags, setTags] = useState(getTagsInput(initialPost));
  const [published, setPublished] = useState(initialPost?.published ?? false);

  const handleSubmit = useCallback(() => {
    onSubmit({
      content,
      published,
      tags,
      title,
    });
  }, [content, onSubmit, published, tags, title]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>My Memo</Text>
        <Text style={styles.title}>
          {mode === "create" ? "新規作成" : "メモ編集"}
        </Text>

        <View style={styles.formField}>
          <Text style={styles.label}>タイトル</Text>
          <TextInput
            editable={!saving}
            onChangeText={setTitle}
            placeholder="タイトル"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={title}
          />
        </View>

        <View style={styles.formField}>
          <Text style={styles.label}>本文</Text>
          <TextInput
            editable={!saving}
            multiline
            onChangeText={setContent}
            placeholder="本文"
            placeholderTextColor="#94a3b8"
            style={[styles.input, styles.bodyInput]}
            textAlignVertical="top"
            value={content}
          />
        </View>

        <View style={styles.formField}>
          <Text style={styles.label}>タグ</Text>
          <TextInput
            autoCapitalize="none"
            editable={!saving}
            onChangeText={setTags}
            placeholder="仕事, アイデア"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={tags}
          />
          <Text style={styles.fieldHint}>カンマ区切りで入力します。</Text>
        </View>

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.label}>公開設定</Text>
            <Text style={styles.fieldHint}>
              公開にするとWeb版と同じ公開状態になります。
            </Text>
          </View>
          <Switch
            disabled={saving}
            onValueChange={setPublished}
            value={published}
          />
        </View>

        {error ? <Text style={styles.formError}>{error}</Text> : null}

        <View style={styles.formActions}>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed || saving ? styles.buttonPressed : undefined,
            ]}
          >
            <Text style={styles.secondaryButtonText}>キャンセル</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed || saving ? styles.buttonPressed : undefined,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>保存</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [restoringToken, setRestoringToken] = useState(true);
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
    setPassword("");
    setLoginError(nextLoginError);
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
    setViewMode("create");
  }, []);

  const handleEdit = useCallback(() => {
    setFormError("");
    setViewMode("edit");
  }, []);

  const handleCancelForm = useCallback(() => {
    setFormError("");
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
    async (payload: MobilePostPayload) => {
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
        const createdPost = await createMobilePost(accessToken, payload);
        setPosts((currentPosts) => [createdPost, ...currentPosts]);
        setSelectedPost(createdPost);
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
    async (payload: MobilePostPayload) => {
      if (!accessToken || !selectedPost) {
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
          selectedPost.id,
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
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.loginScreen}
        >
          <View style={styles.loginPanel}>
            <Text style={styles.kicker}>My Memo</Text>
            <Text style={styles.loginTitle}>ログイン</Text>

            <View style={styles.formField}>
              <Text style={styles.label}>メールアドレス</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!loginLoading}
                inputMode="email"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>パスワード</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!loginLoading}
                onChangeText={setPassword}
                placeholder="パスワード"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                style={styles.input}
                textContentType="password"
                value={password}
              />
            </View>

            {loginError ? (
              <Text style={styles.loginError}>{loginError}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={loginLoading}
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.loginButton,
                pressed || loginLoading ? styles.buttonPressed : undefined,
              ]}
            >
              {loginLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginButtonText}>ログイン</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (viewMode === "create") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <MemoForm
          error={formError}
          key="create"
          mode="create"
          onCancel={handleCancelForm}
          onSubmit={(payload) => {
            void handleSaveCreate(payload);
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
          error={formError}
          initialPost={selectedPost}
          key={`edit-${selectedPost.id}`}
          mode="edit"
          onCancel={handleCancelForm}
          onSubmit={(payload) => {
            void handleSaveEdit(payload);
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
            <Pressable
              accessibilityRole="button"
              onPress={() => setViewMode("list")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>戻る</Text>
            </Pressable>
            <View style={styles.detailActions}>
              <Pressable
                accessibilityRole="button"
                disabled={!selectedPost || detailLoading || deleting}
                onPress={handleEdit}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed ? styles.buttonPressed : undefined,
                ]}
              >
                <Text style={styles.secondaryButtonText}>編集</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!selectedPost || detailLoading || deleting}
                onPress={confirmDelete}
                style={({ pressed }) => [
                  styles.dangerButton,
                  pressed || deleting ? styles.buttonPressed : undefined,
                ]}
              >
                {deleting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.dangerButtonText}>削除</Text>
                )}
              </Pressable>
            </View>
          </View>

          {detailLoading && !selectedPost ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#2563eb" size="large" />
              <Text style={styles.stateText}>メモを読み込んでいます</Text>
            </View>
          ) : selectedPost ? (
            <View>
              <View style={styles.detailHeader}>
                <Text style={styles.kicker}>My Memo</Text>
                <Text style={styles.detailTitle}>{selectedPost.title}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    selectedPost.published
                      ? styles.statusBadgePublic
                      : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      selectedPost.published
                        ? styles.statusBadgeTextPublic
                        : undefined,
                    ]}
                  >
                    {selectedPost.published ? "公開" : "非公開"}
                  </Text>
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
                    <View key={tag.id} style={styles.tag}>
                      <Text style={styles.tagText}>#{tag.name}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noTags}>タグなし</Text>
                )}
              </View>

              <Text style={styles.updatedAt}>
                作成: {formatUpdatedAt(selectedPost.createdAt)}
              </Text>
              <Text style={styles.updatedAt}>
                更新: {formatUpdatedAt(selectedPost.updatedAt)}
              </Text>
            </View>
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
            <Text style={styles.kicker}>My Memo</Text>
            <Text style={styles.title}>メモ一覧</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={handleCreate}
              style={({ pressed }) => [
                styles.primarySmallButton,
                pressed ? styles.buttonPressed : undefined,
              ]}
            >
              <Text style={styles.primarySmallButtonText}>新規</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleRefresh}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed ? styles.buttonPressed : undefined,
              ]}
            >
              <Text style={styles.refreshButtonText}>更新</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.logoutButton,
                pressed ? styles.buttonPressed : undefined,
              ]}
            >
              <Text style={styles.logoutButtonText}>ログアウト</Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#2563eb" size="large" />
            <Text style={styles.stateText}>メモを読み込んでいます</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorTitle}>{errorTitle}</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => loadPosts(accessToken)}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>再試行</Text>
            </Pressable>
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
    backgroundColor: "#f8fafc",
  },
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  loginScreen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  loginPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
  },
  loginTitle: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 24,
    marginTop: 4,
  },
  formContent: {
    padding: 20,
    paddingBottom: 36,
  },
  formField: {
    marginBottom: 16,
  },
  label: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  fieldHint: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    color: "#111827",
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  bodyInput: {
    minHeight: 180,
    paddingTop: 12,
  },
  switchRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 16,
    padding: 14,
  },
  loginError: {
    color: "#b91c1c",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  formError: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 8,
    borderWidth: 1,
    color: "#b91c1c",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
    padding: 12,
  },
  loginButton: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  kicker: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "700",
  },
  title: {
    color: "#111827",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 4,
  },
  headerActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 112,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  primarySmallButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primarySmallButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  refreshButton: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  logoutButton: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
  },
  dangerButton: {
    alignItems: "center",
    backgroundColor: "#dc2626",
    borderRadius: 8,
    justifyContent: "center",
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dangerButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.75,
  },
  refreshButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  logoutButtonText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
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
  retryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
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
    paddingBottom: 28,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  cardTitle: {
    color: "#111827",
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgePublic: {
    backgroundColor: "#dcfce7",
  },
  statusBadgeText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  statusBadgeTextPublic: {
    color: "#166534",
  },
  cardContent: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  tag: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "700",
  },
  noTags: {
    color: "#94a3b8",
    fontSize: 13,
  },
  updatedAt: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 14,
  },
  detailContent: {
    padding: 20,
    paddingBottom: 36,
  },
  detailTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  detailActions: {
    flexDirection: "row",
    gap: 8,
  },
  detailHeader: {
    gap: 10,
    marginBottom: 16,
  },
  detailTitle: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 36,
  },
  detailBody: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 8,
    borderWidth: 1,
    color: "#1f2937",
    fontSize: 16,
    lineHeight: 25,
    minHeight: 180,
    padding: 16,
  },
  inlineLoading: {
    color: "#2563eb",
    fontSize: 13,
    marginBottom: 10,
  },
});
