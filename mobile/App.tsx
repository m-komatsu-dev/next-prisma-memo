import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchMobilePosts, MobileApiRequestError } from "./src/api/posts";
import type { MobilePost } from "./src/types/posts";

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

function PostCard({ post }: { post: MobilePost }) {
  const updatedAt = useMemo(
    () => formatUpdatedAt(post.updatedAt),
    [post.updatedAt],
  );

  return (
    <View style={styles.card}>
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
    </View>
  );
}

export default function App() {
  const [posts, setPosts] = useState<MobilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const loadPosts = useCallback(async (nextRefreshing = false) => {
    if (nextRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    setErrorStatus(null);

    try {
      const nextPosts = await fetchMobilePosts();
      setPosts(nextPosts);
    } catch (caughtError) {
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
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadPosts();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadPosts]);

  const errorTitle =
    errorStatus === 401 ? "ログインが必要です" : "取得できませんでした";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>My Memo</Text>
            <Text style={styles.title}>メモ一覧</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => loadPosts(true)}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed ? styles.refreshButtonPressed : undefined,
            ]}
          >
            <Text style={styles.refreshButtonText}>更新</Text>
          </Pressable>
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
              onPress={() => loadPosts()}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>再試行</Text>
            </Pressable>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyTitle}>メモはまだありません</Text>
            <Text style={styles.emptyText}>
              Web版で作成したメモがここに表示されます。
            </Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={posts}
            keyExtractor={(item) => String(item.id)}
            onRefresh={() => loadPosts(true)}
            refreshing={refreshing}
            renderItem={({ item }) => <PostCard post={item} />}
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
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  header: {
    alignItems: "center",
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
  refreshButton: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  refreshButtonPressed: {
    opacity: 0.75,
  },
  refreshButtonText: {
    color: "#ffffff",
    fontSize: 14,
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
});
