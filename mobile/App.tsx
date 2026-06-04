import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
import {
  deleteMobileAccount,
  loginWithEmailPassword,
  logoutMobileSession,
  refreshMobileTokens,
} from "./src/api/auth";
import {
  revokeMobilePushSubscription,
  sendMobileTestPush,
} from "./src/api/push-subscriptions";
import {
  createMobilePostShare,
  createMobilePost,
  createMobileTodoItem,
  deleteMobilePostShare,
  deleteMobilePost,
  deleteMobileTodoItem,
  fetchMobileAllTodos,
  fetchMobilePostShares,
  fetchMobilePost,
  fetchMobilePosts,
  fetchMobileTodoCalendar,
  MobileApiRequestError,
  updateMobilePostShare,
  updateMobilePost,
  updateMobileTodoItem,
} from "./src/api/posts";
import {
  deleteStoredAuthTokens,
  getStoredAuthTokens,
  saveAuthTokens,
} from "./src/storage/auth-token";
import { registerPushTokenAfterLogin } from "./src/notifications/register-push-token";
import { Badge, Button, Card, TextField } from "./src/components/ui";
import { colors, radius, spacing, typography } from "./src/theme";
import {
  createEditorLineId,
  moveCompletedTodoToBottom,
  normalizeChecklistContentForSave,
  parseEditorContent,
  serializeEditorLines,
} from "./src/todo-utils";
import type { EditorLine } from "./src/todo-utils";
import type {
  MobileAiMode,
  MobileCrossMemoTodoItem,
  MobilePost,
  MobilePostPayload,
  MobilePostShare,
  MobilePostShareRole,
  MobileTodoItem,
} from "./src/types/posts";

type ViewMode =
  | "list"
  | "detail"
  | "create-choice"
  | "create"
  | "create-todo"
  | "edit"
  | "share"
  | "todos"
  | "calendar"
  | "account";
type AuthViewMode = "landing" | "login";
type AutoSaveStatus = "unsaved" | "saving" | "saved" | "error";
type StatusFilter = "all" | "mine" | "shared" | "published" | "private";
type SortMode = "updated-desc" | "created-desc" | "title-asc";
type TodoFilter =
  | "all"
  | "active"
  | "completed"
  | "today"
  | "tomorrow"
  | "week"
  | "overdue"
  | "noDue";
type MainTab = "list" | "todos" | "calendar" | "account";
type CalendarQuickFilter = "today" | "tomorrow" | "week" | "overdue";

const AUTO_SAVE_DEBOUNCE_MS = 1500;
const MOBILE_MEMO_INITIAL_LIMIT = 30;
const MOBILE_TODO_INITIAL_LIMIT = 100;
const MOBILE_CALENDAR_INITIAL_LIMIT = 180;
const DUE_TODO_MEMO_PAYLOAD: MobilePostPayload = {
  content: "期限付きTodo",
  kind: "dueTodo",
  published: false,
  tags: "",
  title: "期限付きTodo",
  todoListDueAt: null,
};

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
    title: "権限を分けて共有",
    description: "必要な相手にだけ閲覧・編集権限を分けて共有できます。",
  },
];

const statusFilters: { label: string; value: StatusFilter }[] = [
  { label: "すべて", value: "all" },
  { label: "自分", value: "mine" },
  { label: "共有", value: "shared" },
  { label: "公開", value: "published" },
  { label: "非公開", value: "private" },
];

const sortOptions: { label: string; value: SortMode }[] = [
  { label: "更新日", value: "updated-desc" },
  { label: "作成日", value: "created-desc" },
  { label: "タイトル", value: "title-asc" },
];

const todoFilters: { label: string; value: TodoFilter }[] = [
  { label: "すべて", value: "all" },
  { label: "未完了", value: "active" },
  { label: "完了済み", value: "completed" },
  { label: "今日", value: "today" },
  { label: "明日", value: "tomorrow" },
  { label: "今週", value: "week" },
  { label: "期限切れ", value: "overdue" },
  { label: "期限なし", value: "noDue" },
];

const calendarQuickFilters: { label: string; value: CalendarQuickFilter }[] = [
  { label: "今日", value: "today" },
  { label: "明日", value: "tomorrow" },
  { label: "今週", value: "week" },
  { label: "期限切れ", value: "overdue" },
];

const mainTabs: { label: string; value: MainTab }[] = [
  { label: "メモ", value: "list" },
  { label: "Todo", value: "todos" },
  { label: "カレンダー", value: "calendar" },
  { label: "アカウント", value: "account" },
];

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

const todoDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const calendarDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

const calendarMonthFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "long",
  year: "numeric",
});

const calendarWeekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function formatTodoDateTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : todoDateFormatter.format(date);
}

function formatDateTimeInput(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function parseTodoDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/, "$1T$2");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildLocalDateTimeIso(dateKey: string, timeValue: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);

  if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getLocalDayStart(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function addLocalDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function isSameLocalDay(value: string | null, targetDate: Date) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const start = getLocalDayStart(targetDate);
  const end = addLocalDays(start, 1);
  return date.getTime() >= start.getTime() && date.getTime() < end.getTime();
}

function isTodoOverdue(todo: Pick<MobileTodoItem, "completed" | "dueAt">) {
  if (!todo.dueAt || todo.completed) return false;

  const dueDate = new Date(todo.dueAt);
  return !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now();
}

function isTodoDueThisWeek(todo: Pick<MobileTodoItem, "dueAt">) {
  if (!todo.dueAt) return false;

  const dueDate = new Date(todo.dueAt);
  if (Number.isNaN(dueDate.getTime())) return false;

  const start = getLocalDayStart(new Date());
  const end = addLocalDays(start, 7);
  return dueDate.getTime() >= start.getTime() && dueDate.getTime() < end.getTime();
}

function getTodoDueLabel(todo: Pick<MobileTodoItem, "completed" | "dueAt">) {
  if (!todo.dueAt) return "期限なし";
  if (isTodoOverdue(todo)) return `期限切れ ${formatTodoDateTime(todo.dueAt)}`;
  if (isSameLocalDay(todo.dueAt, new Date())) {
    return `今日 ${formatTodoDateTime(todo.dueAt)}`;
  }
  if (isSameLocalDay(todo.dueAt, addLocalDays(new Date(), 1))) {
    return `明日 ${formatTodoDateTime(todo.dueAt)}`;
  }
  return `期限 ${formatTodoDateTime(todo.dueAt)}`;
}

function getTodoReminderLabel(todo: Pick<MobileTodoItem, "completed" | "reminderAt" | "reminderSentAt">) {
  if (!todo.reminderAt) return "";

  const reminderDate = new Date(todo.reminderAt);
  const reminderText = formatTodoDateTime(todo.reminderAt);

  if (todo.reminderSentAt) return `通知済み ${reminderText}`;
  if (
    !todo.completed &&
    !Number.isNaN(reminderDate.getTime()) &&
    reminderDate.getTime() <= Date.now()
  ) {
    return `未送信リマインダー ${reminderText}`;
  }
  return `通知予定 ${reminderText}`;
}

function matchesTodoFilter(todo: MobileTodoItem, filter: TodoFilter) {
  switch (filter) {
    case "active":
      return !todo.completed;
    case "completed":
      return todo.completed;
    case "today":
      return isSameLocalDay(todo.dueAt, new Date());
    case "tomorrow":
      return isSameLocalDay(todo.dueAt, addLocalDays(new Date(), 1));
    case "week":
      return isTodoDueThisWeek(todo);
    case "overdue":
      return isTodoOverdue(todo);
    case "noDue":
      return todo.dueAt === null;
    case "all":
    default:
      return true;
  }
}

function compareTodos(a: MobileTodoItem, b: MobileTodoItem) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;

  const aOverdue = isTodoOverdue(a);
  const bOverdue = isTodoOverdue(b);
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

  const aDue = a.dueAt ? new Date(a.dueAt).getTime() : null;
  const bDue = b.dueAt ? new Date(b.dueAt).getTime() : null;
  if (aDue !== null && bDue !== null && aDue !== bDue) return aDue - bDue;
  if (aDue !== null || bDue !== null) return aDue === null ? 1 : -1;

  return a.position - b.position || a.id - b.id;
}

function getCalendarDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return getLocalDateKey(date);
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return dateKey;
  }

  return calendarDateFormatter.format(new Date(year, month - 1, day));
}

function getTimeValueFromIso(value: string | null) {
  if (!value) return "09:00";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "09:00";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addLocalMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getCalendarMonthCells(monthDate: Date) {
  const monthStart = getMonthStart(monthDate);
  const gridStart = addLocalDays(monthStart, -monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = addLocalDays(gridStart, index);
    return {
      date,
      dateKey: getLocalDateKey(date),
      inCurrentMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
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
    kind: payload.kind ?? "text",
    published: payload.published,
    tags: payload.tags,
    title: payload.title,
    todoListDueAt: payload.todoListDueAt ?? null,
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

function PostTodoItemsPreview({
  todoItems,
  todoItemsCount,
}: {
  todoItems: MobileTodoItem[];
  todoItemsCount?: number;
}) {
  const sortedTodoItems = useMemo(
    () => [...todoItems].sort(compareTodos),
    [todoItems],
  );
  const visibleItems = sortedTodoItems.slice(0, 4);
  const totalTodoItems = todoItemsCount ?? sortedTodoItems.length;

  if (visibleItems.length === 0) {
    return (
      <Text style={styles.cardContent} numberOfLines={2}>
        Todo項目なし
      </Text>
    );
  }

  return (
    <View style={styles.cardContentPreview}>
      {visibleItems.map((todo) => (
        <View key={todo.id} style={styles.cardTodoPreviewLine}>
          <View
            style={[
              styles.cardTodoCheckbox,
              todo.completed ? styles.todoCheckboxChecked : undefined,
            ]}
          >
            {todo.completed ? (
              <Text style={styles.cardTodoCheckboxMark}>x</Text>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.cardTodoPreviewText,
              todo.completed ? styles.todoTextChecked : undefined,
            ]}
          >
            {todo.text}
          </Text>
          {todo.dueAt ? (
            <Text
              numberOfLines={1}
              style={[
                styles.cardTodoPreviewDue,
                isTodoOverdue(todo) ? styles.modelTodoMetaOverdue : undefined,
              ]}
            >
              期限 {formatTodoDateTime(todo.dueAt)}
            </Text>
          ) : null}
        </View>
      ))}
      {totalTodoItems > visibleItems.length ? (
        <Text style={styles.cardTodoPreviewMore}>
          他 {totalTodoItems - visibleItems.length} 件
        </Text>
      ) : null}
    </View>
  );
}

function isTodoListPost(post: MobilePost) {
  return (
    post.kind === "dueTodo" ||
    post.todoListDueAt !== null ||
    post.content.trim() === "期限付きTodo"
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
            {post.accessRole === "viewer" ? (
              <Badge variant="shared">viewer</Badge>
            ) : null}
            {post.accessRole === "editor" ? (
              <Badge variant="shared">editor</Badge>
            ) : null}
          </View>

          <Text style={styles.cardTitle} numberOfLines={2}>
            {post.title}
          </Text>

          {isTodoListPost(post) ? (
            <PostTodoItemsPreview
              todoItems={post.todoItems ?? []}
              todoItemsCount={post.todoItemsCount}
            />
          ) : (
            <PostContentPreview content={post.content} />
          )}

          {isTodoListPost(post) && post.todoListDueAt ? (
            <Text style={styles.memoDueLabel}>
              リスト期限 {formatUpdatedAt(post.todoListDueAt)}
            </Text>
          ) : null}

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

function MainTabBar({
  activeTab,
  onNavigate,
}: {
  activeTab: MainTab;
  onNavigate: (tab: MainTab) => void;
}) {
  return (
    <View style={styles.mainTabBar}>
      {mainTabs.map((tab) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeTab === tab.value }}
          key={tab.value}
          onPress={() => onNavigate(tab.value)}
          style={({ pressed }) => [
            styles.mainTabButton,
            activeTab === tab.value ? styles.mainTabButtonActive : undefined,
            pressed ? styles.buttonPressed : undefined,
          ]}
        >
          <Text
            style={[
              styles.mainTabText,
              activeTab === tab.value ? styles.mainTabTextActive : undefined,
            ]}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function TodoItemRow({
  canEdit,
  onDelete,
  onEdit,
  onPress,
  onToggle,
  postTitle,
  saving,
  todo,
}: {
  canEdit: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onPress?: () => void;
  onToggle?: () => void;
  postTitle?: string;
  saving?: boolean;
  todo: MobileTodoItem;
}) {
  const overdue = isTodoOverdue(todo);
  const reminderLabel = getTodoReminderLabel(todo);

  const content = (
    <>
      <Text
        style={[
          styles.modelTodoText,
          todo.completed ? styles.todoTextChecked : undefined,
        ]}
      >
        {todo.text}
      </Text>
      <View style={styles.modelTodoMetaRow}>
        {postTitle ? (
          <Text style={styles.modelTodoMeta} numberOfLines={1}>
            {postTitle}
          </Text>
        ) : null}
        <Text
          style={[
            styles.modelTodoMeta,
            overdue ? styles.modelTodoMetaOverdue : undefined,
          ]}
        >
          {getTodoDueLabel(todo)}
        </Text>
        {reminderLabel ? (
          <Text
            style={[
              styles.modelTodoMeta,
              reminderLabel.startsWith("未送信")
                ? styles.modelTodoMetaOverdue
                : undefined,
            ]}
          >
            {reminderLabel}
          </Text>
        ) : null}
        {!canEdit ? <Text style={styles.modelTodoMeta}>閲覧のみ</Text> : null}
      </View>
    </>
  );

  return (
    <View
      style={[
        styles.modelTodoRow,
        todo.completed ? styles.modelTodoRowCompleted : undefined,
        overdue ? styles.modelTodoRowOverdue : undefined,
      ]}
    >
      <View style={styles.modelTodoMain}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: todo.completed }}
          disabled={!canEdit || saving || !onToggle}
          onPress={onToggle}
          style={({ pressed }) => [
            styles.modelTodoCheckButton,
            pressed ? styles.buttonPressed : undefined,
          ]}
        >
          <View
            style={[
              styles.todoCheckbox,
              todo.completed ? styles.todoCheckboxChecked : undefined,
            ]}
          >
            {todo.completed ? <Text style={styles.todoCheckboxMark}>x</Text> : null}
          </View>
        </Pressable>

        {onPress ? (
          <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [
              styles.modelTodoTextBlock,
              pressed ? styles.buttonPressed : undefined,
            ]}
          >
            {content}
          </Pressable>
        ) : (
          <View style={styles.modelTodoTextBlock}>{content}</View>
        )}
      </View>

      {canEdit && (onEdit || onDelete) ? (
        <View style={styles.modelTodoActions}>
          {onEdit ? (
            <Button
              disabled={saving}
              onPress={onEdit}
              style={styles.modelTodoActionButton}
              variant="secondary"
            >
              編集
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              disabled={saving}
              onPress={onDelete}
              style={styles.modelTodoActionButton}
              variant="danger"
            >
              削除
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function CalendarMonthGrid({
  monthDate,
  onMonthChange,
  onSelectDate,
  selectedDateKey,
  todosByDate,
}: {
  monthDate: Date;
  onMonthChange: (date: Date) => void;
  onSelectDate: (dateKey: string) => void;
  selectedDateKey: string;
  todosByDate: Map<string, MobileCrossMemoTodoItem[]>;
}) {
  const todayKey = getLocalDateKey(new Date());
  const monthCells = useMemo(() => getCalendarMonthCells(monthDate), [monthDate]);

  return (
    <Card style={[styles.calendarMonthPanel, styles.flatSurface]}>
      <View style={styles.calendarMonthHeader}>
        <Text style={styles.calendarMonthTitle}>
          {calendarMonthFormatter.format(monthDate)}
        </Text>
        <View style={styles.calendarMonthActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onMonthChange(addLocalMonths(monthDate, -1))}
            style={({ pressed }) => [
              styles.calendarMonthButton,
              pressed ? styles.buttonPressed : undefined,
            ]}
          >
            <Text style={styles.calendarMonthButtonText}>前の月</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onMonthChange(getMonthStart(new Date()));
              onSelectDate(todayKey);
            }}
            style={({ pressed }) => [
              styles.calendarMonthButton,
              pressed ? styles.buttonPressed : undefined,
            ]}
          >
            <Text style={styles.calendarMonthButtonText}>今日</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onMonthChange(addLocalMonths(monthDate, 1))}
            style={({ pressed }) => [
              styles.calendarMonthButton,
              pressed ? styles.buttonPressed : undefined,
            ]}
          >
            <Text style={styles.calendarMonthButtonText}>次の月</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.calendarWeekdayRow}>
        {calendarWeekdayLabels.map((label) => (
          <Text key={label} style={styles.calendarWeekdayText}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.calendarDateGrid}>
        {monthCells.map((cell) => {
          const cellTodos = todosByDate.get(cell.dateKey) ?? [];
          const visibleTodo = cellTodos[0];
          const hasOverdue = cellTodos.some(isTodoOverdue);
          const allCompleted =
            cellTodos.length > 0 && cellTodos.every((todo) => todo.completed);
          const isSelected = selectedDateKey === cell.dateKey;
          const isToday = todayKey === cell.dateKey;

          return (
            <Pressable
              accessibilityRole="button"
              key={cell.dateKey}
              onPress={() => onSelectDate(cell.dateKey)}
              style={({ pressed }) => [
                styles.calendarDateCell,
                !cell.inCurrentMonth ? styles.calendarDateCellMuted : undefined,
                isToday ? styles.calendarDateCellToday : undefined,
                hasOverdue ? styles.calendarDateCellOverdue : undefined,
                isSelected ? styles.calendarDateCellSelected : undefined,
                allCompleted ? styles.calendarDateCellCompleted : undefined,
                pressed ? styles.buttonPressed : undefined,
              ]}
            >
              <Text
                style={[
                  styles.calendarDateNumber,
                  !cell.inCurrentMonth ? styles.calendarDateNumberMuted : undefined,
                  isSelected ? styles.calendarDateNumberSelected : undefined,
                ]}
              >
                {cell.date.getDate()}
              </Text>
              {cellTodos.length > 0 ? (
                <>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.calendarDateCount,
                      hasOverdue ? styles.calendarDateCountOverdue : undefined,
                      isSelected ? styles.calendarDateCountSelected : undefined,
                    ]}
                  >
                    {cellTodos.length}件
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.calendarDateTodoText,
                      visibleTodo?.completed
                        ? styles.calendarDateTodoTextCompleted
                        : undefined,
                      isSelected ? styles.calendarDateTodoTextSelected : undefined,
                    ]}
                  >
                    {visibleTodo?.text}
                  </Text>
                </>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function TodoItemsPanel({
  canEdit,
  error,
  forceDueTodo,
  hideCreateForm = false,
  onCreate,
  onDelete,
  onToggle,
  onUpdate,
  savingId,
  todoItems,
}: {
  canEdit: boolean;
  error: string;
  forceDueTodo?: boolean;
  hideCreateForm?: boolean;
  onCreate: (payload: { dueAt: string | null; reminderAt?: string | null; text: string }) => void;
  onDelete: (todo: MobileTodoItem) => void;
  onToggle: (todo: MobileTodoItem) => void;
  onUpdate: (
    todo: MobileTodoItem,
    payload: { dueAt?: string | null; reminderAt?: string | null; text?: string },
  ) => void;
  savingId: number | "new" | null;
  todoItems: MobileTodoItem[];
}) {
  const [newTodoKind, setNewTodoKind] = useState<"normal" | "due">(
    forceDueTodo ? "due" : "normal",
  );
  const [newText, setNewText] = useState("");
  const [newDueAt, setNewDueAt] = useState("");
  const [newReminderAt, setNewReminderAt] = useState("");
  const [localError, setLocalError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editReminderAt, setEditReminderAt] = useState("");
  const sortedTodoItems = useMemo(
    () => [...todoItems].sort(compareTodos),
    [todoItems],
  );

  const beginEdit = useCallback((todo: MobileTodoItem) => {
    setEditingId(todo.id);
    setEditText(todo.text);
    setEditDueAt(formatDateTimeInput(todo.dueAt));
    setEditReminderAt(formatDateTimeInput(todo.reminderAt));
    setLocalError("");
  }, []);

  const submitNewTodo = useCallback(() => {
    const text = newText.trim();
    if (!text) {
      setLocalError("Todo本文を入力してください。");
      return;
    }

    const activeTodoKind = forceDueTodo ? "due" : newTodoKind;
    const dueAt = activeTodoKind === "due" ? parseTodoDateInput(newDueAt) : null;
    if (activeTodoKind === "due" && !dueAt) {
      setLocalError("期限日時を YYYY-MM-DD HH:mm 形式で入力してください。");
      return;
    }

    const reminderAt = newReminderAt.trim()
      ? parseTodoDateInput(newReminderAt)
      : null;
    if (newReminderAt.trim() && !reminderAt) {
      setLocalError("リマインダー日時を YYYY-MM-DD HH:mm 形式で入力してください。");
      return;
    }

    setLocalError("");
    onCreate({ dueAt, reminderAt, text });
    setNewText("");
    setNewDueAt("");
    setNewReminderAt("");
  }, [forceDueTodo, newDueAt, newReminderAt, newText, newTodoKind, onCreate]);

  const submitEdit = useCallback(
    (todo: MobileTodoItem) => {
      const text = editText.trim();
      if (!text) {
        setLocalError("Todo本文を入力してください。");
        return;
      }

      const dueAt = editDueAt.trim() ? parseTodoDateInput(editDueAt) : null;
      if (forceDueTodo && !dueAt) {
        setLocalError("期限付きTodoでは期限日時を選択してください。");
        return;
      }
      if (editDueAt.trim() && !dueAt) {
        setLocalError("期限日時を YYYY-MM-DD HH:mm 形式で入力してください。");
        return;
      }

      const reminderAt = editReminderAt.trim()
        ? parseTodoDateInput(editReminderAt)
        : null;
      if (editReminderAt.trim() && !reminderAt) {
        setLocalError("リマインダー日時を YYYY-MM-DD HH:mm 形式で入力してください。");
        return;
      }

      setLocalError("");
      onUpdate(todo, { dueAt, reminderAt, text });
      setEditingId(null);
    },
    [editDueAt, editReminderAt, editText, forceDueTodo, onUpdate],
  );

  return (
    <View style={styles.modelTodoPanel}>
      <View style={styles.modelTodoHeader}>
        <View>
          <Text style={styles.kicker}>Todo items</Text>
          <Text style={styles.modelTodoTitle}>期限付きTodo</Text>
        </View>
        {!canEdit ? <Badge variant="shared">閲覧のみ</Badge> : null}
      </View>

      {canEdit && !hideCreateForm ? (
        <Card style={[styles.modelTodoForm, styles.flatSurface]}>
          {!forceDueTodo ? (
            <View style={styles.todoKindRow}>
              {(["normal", "due"] as const).map((kind) => (
                <Pressable
                  accessibilityRole="button"
                  key={kind}
                  onPress={() => setNewTodoKind(kind)}
                  style={[
                    styles.filterChip,
                    newTodoKind === kind ? styles.filterChipActive : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      newTodoKind === kind ? styles.filterChipTextActive : undefined,
                    ]}
                  >
                    {kind === "normal" ? "普通のTodo" : "期限付きTodo"}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextField
            editable={savingId !== "new"}
            label="Todo本文"
            onChangeText={setNewText}
            placeholder="やること"
            value={newText}
          />
          {forceDueTodo || newTodoKind === "due" ? (
            <TextField
              editable={savingId !== "new"}
              label="期限日時"
              onChangeText={setNewDueAt}
              placeholder="2026-05-29 18:30"
              value={newDueAt}
            />
          ) : null}
          <TextField
            editable={savingId !== "new"}
            label="リマインダー"
            onChangeText={setNewReminderAt}
            placeholder="任意: 2026-05-29 09:00"
            value={newReminderAt}
          />
          <Button
            disabled={savingId !== null}
            loading={savingId === "new"}
            onPress={submitNewTodo}
            style={styles.fullButton}
          >
            Todoを追加
          </Button>
        </Card>
      ) : null}

      {error || localError ? (
        <Text style={styles.formError}>{localError || error}</Text>
      ) : null}

      {sortedTodoItems.length > 0 ? (
        <View style={styles.modelTodoList}>
          {sortedTodoItems.map((todo) =>
            editingId === todo.id ? (
              <Card key={todo.id} style={[styles.modelTodoEditCard, styles.flatSurface]}>
                <TextField
                  editable={savingId !== todo.id}
                  label="Todo本文"
                  onChangeText={setEditText}
                  value={editText}
                />
                <TextField
                  editable={savingId !== todo.id}
                  label="期限日時"
                  onChangeText={setEditDueAt}
                  placeholder="空欄で期限なし"
                  value={editDueAt}
                />
                <TextField
                  editable={savingId !== todo.id}
                  label="リマインダー"
                  onChangeText={setEditReminderAt}
                  placeholder="空欄でなし"
                  value={editReminderAt}
                />
                <View style={styles.modelTodoEditActions}>
                  <Button
                    disabled={savingId !== null}
                    onPress={() => setEditingId(null)}
                    style={styles.formActionButton}
                    variant="secondary"
                  >
                    キャンセル
                  </Button>
                  <Button
                    disabled={savingId !== null}
                    loading={savingId === todo.id}
                    onPress={() => submitEdit(todo)}
                    style={styles.formActionButton}
                    variant="dark"
                  >
                    保存
                  </Button>
                </View>
              </Card>
            ) : (
              <TodoItemRow
                canEdit={canEdit}
                key={todo.id}
                onDelete={() => onDelete(todo)}
                onEdit={() => beginEdit(todo)}
                onToggle={() => onToggle(todo)}
                saving={savingId === todo.id}
                todo={todo}
              />
            ),
          )}
        </View>
      ) : (
        <Text style={styles.modelTodoEmpty}>このメモのTodoItemはまだありません。</Text>
      )}
    </View>
  );
}

function NewPostChoiceScreen({
  onCancel,
  onSelectText,
  onSelectTodo,
}: {
  onCancel: () => void;
  onSelectText: () => void;
  onSelectTodo: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.formContent}>
      <View style={styles.editorTopbar}>
        <View style={styles.editorHeading}>
          <Text style={styles.kicker}>New</Text>
          <Text style={styles.title}>新規作成</Text>
        </View>
      </View>

      <View style={styles.creationChoiceGrid}>
        <Pressable
          accessibilityRole="button"
          onPress={onSelectText}
          style={({ pressed }) => [
            styles.creationChoiceCard,
            pressed ? styles.buttonPressed : undefined,
          ]}
        >
          <Text style={styles.creationChoiceLabel}>テキスト</Text>
          <Text style={styles.creationChoiceTitle}>メモ帳として作成</Text>
          <Text style={styles.creationChoiceText}>
            タイトル、本文、タグ、公開設定、AI Assistantを使えます。
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onSelectTodo}
          style={({ pressed }) => [
            styles.creationChoiceCard,
            pressed ? styles.buttonPressed : undefined,
          ]}
        >
          <Text style={styles.creationChoiceLabel}>Todo</Text>
          <Text style={styles.creationChoiceTitle}>期限付きTodoを作成</Text>
          <Text style={styles.creationChoiceText}>
            Todo本文、期限日時、リマインダーだけを入力します。
          </Text>
        </Pressable>
      </View>

      <Button onPress={onCancel} style={styles.fullButton} variant="secondary">
        キャンセル
      </Button>
    </ScrollView>
  );
}

const pickerTimeOptions = Array.from({ length: 32 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

function DateTimePickerField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (nextValue: string) => void;
  value: string | null;
}) {
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    value ? getCalendarDateKey(value) : getLocalDateKey(new Date()),
  );
  const [selectedTime, setSelectedTime] = useState(() => getTimeValueFromIso(value));
  const dateOptions = useMemo(
    () =>
      Array.from({ length: 21 }, (_, index) => {
        const date = addLocalDays(new Date(), index);
        return {
          key: getLocalDateKey(date),
          label:
            index === 0
              ? "今日"
              : index === 1
                ? "明日"
                : formatLocalDateKey(getLocalDateKey(date)),
        };
      }),
    [],
  );

  const commit = useCallback(
    (dateKey: string, timeValue: string) => {
      const nextIso = buildLocalDateTimeIso(dateKey, timeValue);
      if (nextIso) {
        onChange(nextIso);
      }
    },
    [onChange],
  );

  const selectDate = useCallback(
    (dateKey: string) => {
      setSelectedDateKey(dateKey);
      commit(dateKey, selectedTime);
    },
    [commit, selectedTime],
  );

  const selectTime = useCallback(
    (timeValue: string) => {
      setSelectedTime(timeValue);
      commit(selectedDateKey, timeValue);
    },
    [commit, selectedDateKey],
  );

  return (
    <View style={styles.dateTimePicker}>
      <Text style={styles.dateTimePickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.dateTimePickerRow}>
          {dateOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.key}
              onPress={() => selectDate(option.key)}
              style={[
                styles.filterChip,
                selectedDateKey === option.key ? styles.filterChipActive : undefined,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedDateKey === option.key ? styles.filterChipTextActive : undefined,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.dateTimePickerRow}>
          {pickerTimeOptions.map((timeValue) => (
            <Pressable
              accessibilityRole="button"
              key={timeValue}
              onPress={() => selectTime(timeValue)}
              style={[
                styles.filterChip,
                selectedTime === timeValue ? styles.filterChipActive : undefined,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedTime === timeValue ? styles.filterChipTextActive : undefined,
                ]}
              >
                {timeValue}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Text style={styles.dateTimePickerValue}>
        {value ? formatUpdatedAt(value) : "未選択"}
      </Text>
    </View>
  );
}

type DueTodoDraftItem = {
  dueAt: string | null;
  id: string;
  text: string;
};

function createDueTodoDraftItem(): DueTodoDraftItem {
  return {
    dueAt: null,
    id: `${Date.now()}-${Math.random()}`,
    text: "",
  };
}

function DueTodoCreateScreen({
  error,
  onCancel,
  onSubmit,
  saving,
}: {
  error: string;
  onCancel: () => void;
  onSubmit: (payload: {
    items: { dueAt: string; text: string }[];
    tags: string;
    title: string;
    todoListDueAt: string;
  }) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [todoListDueAt, setTodoListDueAt] = useState<string | null>(null);
  const [items, setItems] = useState<DueTodoDraftItem[]>([createDueTodoDraftItem()]);
  const [localError, setLocalError] = useState("");

  const updateItem = useCallback((id: string, patch: Partial<DueTodoDraftItem>) => {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const submit = useCallback(() => {
    const nextTitle = title.trim();
    const normalizedItems = items
      .map((item) => ({ dueAt: item.dueAt, text: item.text.trim() }))
      .filter((item) => item.text.length > 0);

    if (!nextTitle) {
      setLocalError("Todoリストのタイトルを入力してください。");
      return;
    }

    if (!todoListDueAt) {
      setLocalError("Todoリスト全体の期限を選択してください。");
      return;
    }

    if (normalizedItems.length === 0) {
      setLocalError("Todo項目を1件以上入力してください。");
      return;
    }

    if (normalizedItems.some((item) => !item.dueAt)) {
      setLocalError("各Todo項目の期限を選択してください。");
      return;
    }

    setLocalError("");
    onSubmit({
      title: nextTitle,
      tags,
      todoListDueAt,
      items: normalizedItems as { dueAt: string; text: string }[],
    });
  }, [items, onSubmit, tags, title, todoListDueAt]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.editorTopbar}>
          <View style={styles.editorHeading}>
            <Text style={styles.kicker}>Due Todo</Text>
            <Text style={styles.title}>期限付きTodo作成</Text>
          </View>
        </View>

        <Card style={[styles.modelTodoForm, styles.flatSurface]}>
          <TextField
            editable={!saving}
            label="Todoリストのタイトル"
            onChangeText={setTitle}
            placeholder="Todoリストのタイトル"
            value={title}
          />
          <DateTimePickerField
            label="Todoリスト全体の期限"
            onChange={setTodoListDueAt}
            value={todoListDueAt}
          />
          <TextField
            editable={!saving}
            label="タグ"
            onChangeText={setTags}
            placeholder="タグ: 仕事, 買い物, 期限"
            value={tags}
          />
        </Card>

        <Card style={[styles.modelTodoForm, styles.flatSurface]}>
          <View style={styles.modelTodoHeader}>
            <Text style={styles.modelTodoTitle}>Todo項目</Text>
            <Button
              disabled={saving}
              onPress={() => setItems((currentItems) => [...currentItems, createDueTodoDraftItem()])}
              variant="secondary"
            >
              追加
            </Button>
          </View>
          {items.map((item, index) => (
            <View key={item.id} style={styles.dueTodoDraftItem}>
              <TextField
                editable={!saving}
                label={`Todo項目 ${index + 1}`}
                onChangeText={(nextText) => updateItem(item.id, { text: nextText })}
                placeholder="やること"
                value={item.text}
              />
              <DateTimePickerField
                label="項目の期限"
                onChange={(nextDueAt) => updateItem(item.id, { dueAt: nextDueAt })}
                value={item.dueAt}
              />
              <Button
                disabled={saving}
                onPress={() =>
                  setItems((currentItems) =>
                    currentItems.length === 1
                      ? [createDueTodoDraftItem()]
                      : currentItems.filter((currentItem) => currentItem.id !== item.id),
                  )
                }
                variant="danger"
              >
                削除
              </Button>
            </View>
          ))}
        </Card>

        {localError || error ? (
          <Text style={styles.formError}>{localError || error}</Text>
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
            onPress={submit}
            style={styles.formActionButton}
            variant="dark"
          >
            Todoを作成
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MemoTodoSummary({ todoItems }: { todoItems: MobileTodoItem[] }) {
  const sortedTodoItems = useMemo(
    () => [...todoItems].sort(compareTodos).slice(0, 5),
    [todoItems],
  );

  if (todoItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.memoTodoSummary}>
      <Text style={styles.editorToolbarText}>期限付きTodo</Text>
      {sortedTodoItems.map((todo) => (
        <View
          key={todo.id}
          style={[
            styles.memoTodoSummaryRow,
            todo.completed ? styles.modelTodoRowCompleted : undefined,
            isTodoOverdue(todo) ? styles.modelTodoRowOverdue : undefined,
          ]}
        >
          <Text
            style={[
              styles.memoTodoSummaryText,
              todo.completed ? styles.todoTextChecked : undefined,
            ]}
            numberOfLines={2}
          >
            {todo.text}
          </Text>
          <Text
            style={[
              styles.memoTodoSummaryMeta,
              isTodoOverdue(todo) ? styles.modelTodoMetaOverdue : undefined,
            ]}
          >
            {getTodoDueLabel(todo)}
          </Text>
        </View>
      ))}
    </View>
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
        const parsedLine = parseEditorContent(line)[0];

        if (!parsedLine || parsedLine.kind !== "todo") {
          return (
            <Text key={`${line}-${index}`} style={styles.todoParagraph}>
              {line || " "}
            </Text>
          );
        }

        return (
          <View
            key={`${line}-${index}`}
            style={[
              styles.todoLine,
              parsedLine.checked ? styles.todoLineChecked : undefined,
            ]}
          >
            <View
              style={[
                styles.todoCheckbox,
                parsedLine.checked ? styles.todoCheckboxChecked : undefined,
              ]}
            >
              {parsedLine.checked ? (
                <Text style={styles.todoCheckboxMark}>x</Text>
              ) : null}
            </View>
            <Text
              style={[
                styles.todoText,
                parsedLine.checked ? styles.todoTextChecked : undefined,
              ]}
            >
              {parsedLine.text || " "}
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
  canChangePublished = true,
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
  canChangePublished?: boolean;
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
  const [todoListDueAt, setTodoListDueAt] = useState<string | null>(
    initialPost?.todoListDueAt ?? null,
  );
  const isDueTodoPost = initialPost?.kind === "dueTodo";
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
            kind: initialPost.kind,
            published: initialPost.published,
            tags: getTagsInput(initialPost),
            title: initialPost.title,
            todoListDueAt: initialPost.todoListDueAt,
          })
      : "",
  );

  const payload = useMemo(
    () =>
      getNormalizedPayload({
        content,
        kind: initialPost?.kind ?? "text",
        published,
        tags,
        title,
        todoListDueAt: isDueTodoPost ? todoListDueAt : null,
      }),
    [content, initialPost?.kind, isDueTodoPost, published, tags, title, todoListDueAt],
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
              disabled={saving || !canChangePublished}
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

        {!isDueTodoPost ? (
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
        ) : null}

        <Card style={styles.editorSheet}>
          <TextInput
            editable={!saving}
            onChangeText={setTitle}
            placeholder={isDueTodoPost ? "Todoリストのタイトル" : "タイトル"}
            placeholderTextColor="#a0a8b5"
            style={styles.editorTitleInput}
            value={title}
          />

          {isDueTodoPost ? (
            <View style={styles.memoTodoSummary}>
              <DateTimePickerField
                label="Todoリスト全体の期限"
                onChange={setTodoListDueAt}
                value={todoListDueAt}
              />
            </View>
          ) : (
            <>
              <View style={styles.editorToolbar}>
                <Text style={styles.editorToolbarText}>本文</Text>
              </View>

              <TodoListEditor
                editable={!saving}
                onChange={setContent}
                value={content}
              />
            </>
          )}

          {mode === "edit" && initialPost?.todoItems ? (
            <MemoTodoSummary todoItems={initialPost.todoItems} />
          ) : null}

          <TextInput
            autoCapitalize="none"
            editable={!saving}
            onChangeText={setTags}
            placeholder={
              isDueTodoPost
                ? "タグ: 仕事, 買い物, 期限"
                : "タグ: React, 勉強, アイデア"
            }
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

function ShareSettingsScreen({
  addEmail,
  addRole,
  error,
  loading,
  message,
  onAddEmailChange,
  onAddRoleChange,
  onAddShare,
  onBack,
  onRefresh,
  onRevokeShare,
  onUpdateShareRole,
  saving,
  shares,
}: {
  addEmail: string;
  addRole: MobilePostShareRole;
  error: string;
  loading: boolean;
  message: string;
  onAddEmailChange: (nextEmail: string) => void;
  onAddRoleChange: (nextRole: MobilePostShareRole) => void;
  onAddShare: () => void;
  onBack: () => void;
  onRefresh: () => void;
  onRevokeShare: (share: MobilePostShare) => void;
  onUpdateShareRole: (share: MobilePostShare, role: MobilePostShareRole) => void;
  saving: boolean;
  shares: MobilePostShare[];
}) {
  return (
    <ScrollView contentContainerStyle={styles.shareSettingsContent}>
      <View style={styles.accountSettingsTopBar}>
        <Button onPress={onBack} style={styles.toolButton} variant="secondary">
          戻る
        </Button>
        <Button
          disabled={loading || saving}
          loading={loading}
          onPress={onRefresh}
          style={styles.toolButton}
          variant="secondary"
        >
          更新
        </Button>
      </View>

      <View style={styles.accountSettingsHeader}>
        <Text style={styles.kicker}>Sharing</Text>
        <Text style={styles.title}>共有設定</Text>
        <Text style={styles.accountSettingsLead}>
          メールアドレスで共有相手を追加し、閲覧・編集権限を管理します。
        </Text>
      </View>

      <Card style={[styles.shareSettingsCard, styles.flatSurface]}>
        <Text style={styles.accountSettingsSectionTitle}>共有相手を追加</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!saving}
          inputMode="email"
          onChangeText={onAddEmailChange}
          placeholder="user@example.com"
          placeholderTextColor="#a0a8b5"
          style={styles.shareEmailInput}
          value={addEmail}
        />

        <View style={styles.shareRoleSelector}>
          {(["viewer", "editor"] as const).map((role) => (
            <Pressable
              accessibilityRole="button"
              key={role}
              onPress={() => onAddRoleChange(role)}
              style={[
                styles.shareRoleChip,
                addRole === role ? styles.shareRoleChipActive : undefined,
              ]}
            >
              <Text
                style={[
                  styles.shareRoleChipText,
                  addRole === role ? styles.shareRoleChipTextActive : undefined,
                ]}
              >
                {role}
              </Text>
            </Pressable>
          ))}
        </View>

        <Button
          disabled={saving}
          loading={saving}
          onPress={onAddShare}
          style={styles.fullButton}
        >
          共有を追加
        </Button>

        {message ? <Text style={styles.shareSuccessText}>{message}</Text> : null}
        {error ? <Text style={styles.formError}>{error}</Text> : null}
      </Card>

      <Card style={[styles.shareSettingsCard, styles.flatSurface]}>
        <View style={styles.shareListHeader}>
          <Text style={styles.accountSettingsSectionTitle}>共有中</Text>
          <Badge variant="shared">{shares.length} users</Badge>
        </View>

        {loading ? (
          <View style={styles.shareInlineLoading}>
            <ActivityIndicator color={colors.primaryStrong} />
            <Text style={styles.inlineLoading}>共有設定を読み込んでいます</Text>
          </View>
        ) : shares.length === 0 ? (
          <Text style={styles.accountSettingsText}>
            まだ特定ユーザーには共有していません。
          </Text>
        ) : (
          <View style={styles.shareList}>
            {shares.map((share) => (
              <View key={share.id} style={styles.shareRow}>
                <View style={styles.shareUserInfo}>
                  <Text style={styles.shareUserName}>
                    {share.name ?? "名前未設定"}
                  </Text>
                  <Text style={styles.shareUserEmail}>{share.email}</Text>
                </View>

                <View style={styles.shareRoleSelector}>
                  {(["viewer", "editor"] as const).map((role) => (
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      key={role}
                      onPress={() => onUpdateShareRole(share, role)}
                      style={[
                        styles.shareRoleChip,
                        share.role === role ? styles.shareRoleChipActive : undefined,
                        saving ? styles.disabledControl : undefined,
                      ]}
                    >
                      <Text
                        style={[
                          styles.shareRoleChipText,
                          share.role === role
                            ? styles.shareRoleChipTextActive
                            : undefined,
                        ]}
                      >
                        {role}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Button
                  disabled={saving}
                  onPress={() => onRevokeShare(share)}
                  style={styles.fullButton}
                  variant="danger"
                >
                  共有解除
                </Button>
              </View>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
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
  const [postShares, setPostShares] = useState<MobilePostShare[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<MobilePostShareRole>("viewer");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [accountDeleteLoading, setAccountDeleteLoading] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState("");
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushStatusMessage, setPushStatusMessage] = useState("");
  const [pushTestLoading, setPushTestLoading] = useState(false);
  const [todoSavingId, setTodoSavingId] = useState<number | "new" | null>(null);
  const [todoError, setTodoError] = useState("");
  const [allTodos, setAllTodos] = useState<MobileCrossMemoTodoItem[]>([]);
  const [allTodosLoading, setAllTodosLoading] = useState(false);
  const [allTodosRefreshing, setAllTodosRefreshing] = useState(false);
  const [allTodosError, setAllTodosError] = useState("");
  const [todoFilter, setTodoFilter] = useState<TodoFilter>("all");
  const [calendarTodos, setCalendarTodos] = useState<MobileCrossMemoTodoItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarRefreshing, setCalendarRefreshing] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [calendarMonthDate, setCalendarMonthDate] = useState(() =>
    getMonthStart(new Date()),
  );
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState(() =>
    getLocalDateKey(new Date()),
  );
  const [calendarQuickFilter, setCalendarQuickFilter] =
    useState<CalendarQuickFilter | null>(null);
  const selectedPostCanEdit =
    selectedPost?.accessRole === "owner" || selectedPost?.accessRole === "editor";
  const selectedPostCanDelete = selectedPost?.accessRole === "owner";
  const selectedPostCanManageShares = selectedPost?.accessRole === "owner";

  const clearSession = useCallback(async (nextLoginError = "") => {
    await deleteStoredAuthTokens();
    setAccessToken(null);
    setRefreshToken(null);
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
    setPostShares([]);
    setShareEmail("");
    setShareRole("viewer");
    setShareError("");
    setShareMessage("");
    setAccountDeleteError("");
    setPushToken(null);
    setPushStatusMessage("");
    setTodoSavingId(null);
    setTodoError("");
    setAllTodos([]);
    setAllTodosError("");
    setTodoFilter("all");
    setCalendarTodos([]);
    setCalendarError("");
    setCalendarMonthDate(getMonthStart(new Date()));
    setSelectedCalendarDateKey(getLocalDateKey(new Date()));
    setCalendarQuickFilter(null);
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

  const withAuthRetry = useCallback(
    async <T,>(operation: (token: string) => Promise<T>) => {
      if (!accessToken) {
        throw new MobileApiRequestError("ログインが必要です。", 401);
      }

      try {
        return await operation(accessToken);
      } catch (caughtError) {
        if (
          !(caughtError instanceof MobileApiRequestError) ||
          caughtError.status !== 401 ||
          !refreshToken
        ) {
          throw caughtError;
        }

        try {
          const nextTokens = await refreshMobileTokens(refreshToken);
          await saveAuthTokens(nextTokens);
          setAccessToken(nextTokens.accessToken);
          setRefreshToken(nextTokens.refreshToken);

          return await operation(nextTokens.accessToken);
        } catch (refreshError) {
          await clearSession("ログインが必要です。再度ログインしてください。");
          throw refreshError;
        }
      }
    },
    [accessToken, clearSession, refreshToken],
  );

  const registerPushNotifications = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    try {
      const result = await registerPushTokenAfterLogin(accessToken);
      if (result.registered) {
        setPushToken(result.token);
        setPushStatusMessage("通知登録済み");
      } else if (result.reason === "expo-go") {
        setPushStatusMessage("Expo Goでは通知登録をスキップします");
      } else if (result.reason === "permission-denied") {
        setPushStatusMessage("通知許可がオフです");
      } else {
        setPushStatusMessage("通知登録に失敗しました");
      }
    } catch {
      setPushStatusMessage("通知登録に失敗しました");
    }
  }, [accessToken]);

  const loadPosts = useCallback(
    async (nextRefreshing = false) => {
      if (nextRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setErrorStatus(null);

      try {
        const nextPosts = await withAuthRetry((token) =>
          fetchMobilePosts(token, { limit: MOBILE_MEMO_INITIAL_LIMIT }),
        );
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
    [handleAuthError, withAuthRetry],
  );

  const loadAllTodos = useCallback(
    async (nextRefreshing = false) => {
      if (nextRefreshing) {
        setAllTodosRefreshing(true);
      } else {
        setAllTodosLoading(true);
      }

      setAllTodosError("");

      try {
        const todos = await withAuthRetry((token) =>
          fetchMobileAllTodos(token, { limit: MOBILE_TODO_INITIAL_LIMIT }),
        );
        setAllTodos(todos);
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setAllTodosError(
          caughtError instanceof Error
            ? caughtError.message
            : "Todo一覧の取得に失敗しました。",
        );
      } finally {
        setAllTodosLoading(false);
        setAllTodosRefreshing(false);
      }
    },
    [handleAuthError, withAuthRetry],
  );

  const loadCalendarTodos = useCallback(
    async (nextRefreshing = false) => {
      if (nextRefreshing) {
        setCalendarRefreshing(true);
      } else {
        setCalendarLoading(true);
      }

      setCalendarError("");

      try {
        const todos = await withAuthRetry((token) =>
          fetchMobileTodoCalendar(token, { limit: MOBILE_CALENDAR_INITIAL_LIMIT }),
        );
        setCalendarTodos(todos);
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setCalendarError(
          caughtError instanceof Error
            ? caughtError.message
            : "Todoカレンダーの取得に失敗しました。",
        );
      } finally {
        setCalendarLoading(false);
        setCalendarRefreshing(false);
      }
    },
    [handleAuthError, withAuthRetry],
  );

  useEffect(() => {
    let active = true;

    async function restoreToken() {
      try {
        const storedTokens = await getStoredAuthTokens();

        if (active) {
          setAccessToken(storedTokens?.accessToken ?? null);
          setRefreshToken(storedTokens?.refreshToken ?? null);
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

    loadPosts();
  }, [accessToken, loadPosts]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void registerPushNotifications();
  }, [accessToken, registerPushNotifications]);

  useEffect(() => {
    if (!accessToken || viewMode !== "todos") {
      return;
    }

    void loadAllTodos();
  }, [accessToken, loadAllTodos, viewMode]);

  useEffect(() => {
    if (!accessToken || viewMode !== "calendar") {
      return;
    }

    void loadCalendarTodos();
  }, [accessToken, loadCalendarTodos, viewMode]);

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
      await saveAuthTokens(result);
      setAccessToken(result.accessToken);
      setRefreshToken(result.refreshToken);
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

    loadPosts(true);
  }, [accessToken, loadPosts]);

  const handleLogout = useCallback(async () => {
    if (accessToken && pushToken) {
      await revokeMobilePushSubscription(accessToken, pushToken).catch(() => null);
    }

    if (refreshToken) {
      await logoutMobileSession(refreshToken).catch(() => null);
    }

    await clearSession();
  }, [accessToken, clearSession, pushToken, refreshToken]);

  const handleSendTestPush = useCallback(async () => {
    if (!accessToken) {
      setLoginError("ログインが必要です。");
      return;
    }

    setPushTestLoading(true);
    setPushStatusMessage("");

    try {
      await withAuthRetry((token) => sendMobileTestPush(token));
      setPushStatusMessage("テスト通知を送信しました");
    } catch (caughtError) {
      if (await handleAuthError(caughtError)) {
        return;
      }

      setPushStatusMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "テスト通知の送信に失敗しました",
      );
    } finally {
      setPushTestLoading(false);
    }
  }, [accessToken, handleAuthError, withAuthRetry]);

  const performDeleteAccount = useCallback(async () => {
    if (!accessToken) {
      setLoginError("ログインが必要です。");
      return;
    }

    setAccountDeleteLoading(true);
    setAccountDeleteError("");

    try {
      await withAuthRetry((token) => deleteMobileAccount(token));
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
  }, [accessToken, clearSession, handleAuthError, withAuthRetry]);

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

  const navigateMainTab = useCallback((tab: MainTab) => {
    setDetailError("");
    setFormError("");
    setTodoError("");
    setAccountDeleteError("");
    setViewMode(tab);
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
        const latestPost = await withAuthRetry((token) =>
          fetchMobilePost(token, post.id),
        );
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
    [accessToken, handleAuthError, withAuthRetry],
  );

  const openPostDetailById = useCallback(
    async (postId: number) => {
      const cachedPost = posts.find((post) => post.id === postId);

      if (cachedPost) {
        await openPostDetail(cachedPost);
        return;
      }

      if (!accessToken) {
        setLoginError("ログインが必要です。");
        return;
      }

      setSelectedPost(null);
      setCopied(false);
      setViewMode("detail");
      setDetailLoading(true);
      setDetailError("");

      try {
        const latestPost = await withAuthRetry((token) =>
          fetchMobilePost(token, postId),
        );
        setSelectedPost(latestPost);
        setPosts((currentPosts) => [latestPost, ...currentPosts]);
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
    [accessToken, handleAuthError, openPostDetail, posts, withAuthRetry],
  );

  const handleCreate = useCallback(() => {
    setSelectedPost(null);
    setFormError("");
    setAutoSaveError("");
    setTodoError("");
    setViewMode("create-choice");
  }, []);

  const handleCreateText = useCallback(() => {
    setSelectedPost(null);
    setFormError("");
    setAutoSaveError("");
    setViewMode("create");
  }, []);

  const handleCreateDueTodo = useCallback(() => {
    setSelectedPost(null);
    setFormError("");
    setTodoError("");
    setViewMode("create-todo");
  }, []);

  const handleEdit = useCallback(() => {
    if (
      selectedPost?.accessRole !== "owner" &&
      selectedPost?.accessRole !== "editor"
    ) {
      setDetailError("このメモを編集する権限がありません。");
      return;
    }

    setFormError("");
    setAutoSaveError("");
    setViewMode("edit");
  }, [selectedPost]);

  const loadPostShares = useCallback(
    async (postId: number) => {
      if (!accessToken) {
        setLoginError("ログインが必要です。");
        return;
      }

      setShareLoading(true);
      setShareError("");

      try {
        const shares = await withAuthRetry((token) =>
          fetchMobilePostShares(token, postId),
        );
        setPostShares(shares);
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setShareError(
          caughtError instanceof Error
            ? caughtError.message
            : "共有設定の取得に失敗しました。",
        );
      } finally {
        setShareLoading(false);
      }
    },
    [accessToken, handleAuthError, withAuthRetry],
  );

  const openShareSettings = useCallback(() => {
    if (!selectedPost) {
      setDetailError("メモが選択されていません。");
      return;
    }

    if (selectedPost.accessRole !== "owner") {
      setDetailError("共有設定を変更する権限がありません。");
      return;
    }

    setShareEmail("");
    setShareRole("viewer");
    setShareError("");
    setShareMessage("");
    setViewMode("share");
    void loadPostShares(selectedPost.id);
  }, [loadPostShares, selectedPost]);

  const handleAddShare = useCallback(async () => {
    if (!accessToken || !selectedPost) {
      setLoginError("ログインが必要です。");
      return;
    }

    if (selectedPost.accessRole !== "owner") {
      setShareError("共有設定を変更する権限がありません。");
      return;
    }

    const nextEmail = shareEmail.trim();
    if (!nextEmail) {
      setShareError("メールアドレスを入力してください。");
      return;
    }

    setShareSaving(true);
    setShareError("");
    setShareMessage("");

    try {
      const share = await withAuthRetry((token) =>
        createMobilePostShare(token, selectedPost.id, {
          email: nextEmail,
          role: shareRole,
        }),
      );
      setPostShares((currentShares) => {
        const exists = currentShares.some(
          (currentShare) => currentShare.id === share.id,
        );

        return exists
          ? currentShares.map((currentShare) =>
              currentShare.id === share.id ? share : currentShare,
            )
          : [share, ...currentShares];
      });
      setShareEmail("");
      setShareMessage(`${share.email} に共有しました。`);
    } catch (caughtError) {
      if (await handleAuthError(caughtError)) {
        return;
      }

      setShareError(
        caughtError instanceof Error
          ? caughtError.message
          : "共有設定の追加に失敗しました。",
      );
    } finally {
      setShareSaving(false);
    }
  }, [
    accessToken,
    handleAuthError,
    selectedPost,
    shareEmail,
    shareRole,
    withAuthRetry,
  ]);

  const handleUpdateShareRole = useCallback(
    async (share: MobilePostShare, role: MobilePostShareRole) => {
      if (!accessToken || !selectedPost || share.role === role) {
        return;
      }

      if (selectedPost.accessRole !== "owner") {
        setShareError("共有設定を変更する権限がありません。");
        return;
      }

      setShareSaving(true);
      setShareError("");
      setShareMessage("");

      try {
        const updatedShare = await withAuthRetry((token) =>
          updateMobilePostShare(token, selectedPost.id, share.id, role),
        );
        setPostShares((currentShares) =>
          currentShares.map((currentShare) =>
            currentShare.id === updatedShare.id ? updatedShare : currentShare,
          ),
        );
        setShareMessage("共有権限を更新しました。");
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setShareError(
          caughtError instanceof Error
            ? caughtError.message
            : "共有権限の更新に失敗しました。",
        );
      } finally {
        setShareSaving(false);
      }
    },
    [accessToken, handleAuthError, selectedPost, withAuthRetry],
  );

  const performRevokeShare = useCallback(
    async (share: MobilePostShare) => {
      if (!accessToken || !selectedPost) {
        setLoginError("ログインが必要です。");
        return;
      }

      if (selectedPost.accessRole !== "owner") {
        setShareError("共有設定を変更する権限がありません。");
        return;
      }

      setShareSaving(true);
      setShareError("");
      setShareMessage("");

      try {
        await withAuthRetry((token) =>
          deleteMobilePostShare(token, selectedPost.id, share.id),
        );
        setPostShares((currentShares) =>
          currentShares.filter((currentShare) => currentShare.id !== share.id),
        );
        setShareMessage("共有を解除しました。");
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setShareError(
          caughtError instanceof Error
            ? caughtError.message
            : "共有解除に失敗しました。",
        );
      } finally {
        setShareSaving(false);
      }
    },
    [accessToken, handleAuthError, selectedPost, withAuthRetry],
  );

  const confirmRevokeShare = useCallback(
    (share: MobilePostShare) => {
      Alert.alert(
        "共有を解除しますか？",
        `${share.email} はこのメモを見られなくなります。`,
        [
          { style: "cancel", text: "キャンセル" },
          {
            onPress: () => {
              void performRevokeShare(share);
            },
            style: "destructive",
            text: "解除",
          },
        ],
      );
    },
    [performRevokeShare],
  );

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

    if (payload.kind === "dueTodo" && !payload.todoListDueAt) {
      return "Todoリスト全体の期限を選択してください。";
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
        const savedPost = await withAuthRetry((token) =>
          draftPostId
            ? updateMobilePost(token, draftPostId, payload)
            : createMobilePost(token, payload),
        );

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
    [accessToken, handleAuthError, validatePayload, withAuthRetry],
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
        const updatedPost = await withAuthRetry((token) =>
          updateMobilePost(token, postId, payload),
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
    [accessToken, handleAuthError, selectedPost, validatePayload, withAuthRetry],
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
        const savedPost = await withAuthRetry((token) =>
          modeForAutoSave(viewMode, postId) === "create"
            ? createMobilePost(token, payload)
            : updateMobilePost(token, postId as number, payload),
        );

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
    [accessToken, handleAuthError, selectedPost, viewMode, withAuthRetry],
  );

  const handleGenerateAi = useCallback(
    async (content: string, mode: MobileAiMode) => {
      if (!accessToken) {
        setLoginError("ログインが必要です。");
        throw new Error("ログインが必要です。");
      }

      try {
        return await withAuthRetry((token) =>
          generateMobileAiContent(token, content, mode),
        );
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          throw new Error("ログインが必要です。再度ログインしてください。");
        }

        throw caughtError;
      }
    },
    [accessToken, handleAuthError, withAuthRetry],
  );

  const syncPostTodoItems = useCallback(
    (
      postId: number,
      updater: (todoItems: MobileTodoItem[]) => MobileTodoItem[],
    ) => {
      setSelectedPost((currentPost) =>
        currentPost?.id === postId
          ? {
              ...currentPost,
              todoItems: updater(currentPost.todoItems ?? []).sort(compareTodos),
            }
          : currentPost,
      );
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                todoItems: updater(post.todoItems ?? []).sort(compareTodos),
              }
            : post,
        ),
      );
    },
    [],
  );

  const syncCrossMemoTodo = useCallback(
    (todoItem: MobileTodoItem, post: MobilePost, canEdit: boolean) => {
      const nextTodo: MobileCrossMemoTodoItem = {
        ...todoItem,
        canEdit,
        postTitle: post.title,
      };
      setAllTodos((currentTodos) => {
        const exists = currentTodos.some((todo) => todo.id === nextTodo.id);
        return (exists
          ? currentTodos.map((todo) => (todo.id === nextTodo.id ? nextTodo : todo))
          : [nextTodo, ...currentTodos]
        ).sort(compareTodos);
      });
      setCalendarTodos((currentTodos) => {
        if (!nextTodo.dueAt) {
          return currentTodos.filter((todo) => todo.id !== nextTodo.id);
        }

        const exists = currentTodos.some((todo) => todo.id === nextTodo.id);
        return (exists
          ? currentTodos.map((todo) => (todo.id === nextTodo.id ? nextTodo : todo))
          : [nextTodo, ...currentTodos]
        ).sort(compareTodos);
      });
    },
    [],
  );

  const handleSaveDueTodoCreate = useCallback(
    async (payload: {
      items: { dueAt: string; text: string }[];
      tags: string;
      title: string;
      todoListDueAt: string;
    }) => {
      if (!accessToken) {
        setLoginError("ログインが必要です。");
        return;
      }

      setSaving(true);
      setTodoError("");

      try {
        const savedPost = await withAuthRetry((token) =>
          createMobilePost(token, {
            ...DUE_TODO_MEMO_PAYLOAD,
            tags: payload.tags,
            title: payload.title,
            todoListDueAt: payload.todoListDueAt,
          }),
        );
        const todoItems = await Promise.all(
          payload.items.map((item) =>
            withAuthRetry((token) =>
              createMobileTodoItem(token, savedPost.id, {
                dueAt: item.dueAt,
                text: item.text,
              }),
            ),
          ),
        );
        const postWithTodo: MobilePost = {
          ...savedPost,
          todoItems: [...(savedPost.todoItems ?? []), ...todoItems],
        };

        setPosts((currentPosts) => [postWithTodo, ...currentPosts]);
        setSelectedPost(postWithTodo);
        todoItems.forEach((todoItem) => syncCrossMemoTodo(todoItem, postWithTodo, true));
        setViewMode("detail");
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setTodoError(
          caughtError instanceof Error
            ? caughtError.message
            : "期限付きTodoの作成に失敗しました。",
        );
      } finally {
        setSaving(false);
      }
    },
    [accessToken, handleAuthError, syncCrossMemoTodo, withAuthRetry],
  );

  const removeCrossMemoTodo = useCallback((todoItemId: number) => {
    setAllTodos((currentTodos) =>
      currentTodos.filter((todo) => todo.id !== todoItemId),
    );
    setCalendarTodos((currentTodos) =>
      currentTodos.filter((todo) => todo.id !== todoItemId),
    );
  }, []);

  const handleCreateTodoItem = useCallback(
    async (payload: { dueAt: string | null; reminderAt?: string | null; text: string }) => {
      if (!accessToken || !selectedPost) {
        setLoginError("ログインが必要です。");
        return;
      }

      if (!selectedPostCanEdit) {
        setTodoError("このメモを編集する権限がありません。");
        return;
      }

      setTodoSavingId("new");
      setTodoError("");

      try {
        const todoItem = await withAuthRetry((token) =>
          createMobileTodoItem(token, selectedPost.id, payload),
        );
        syncPostTodoItems(selectedPost.id, (todoItems) => [...todoItems, todoItem]);
        syncCrossMemoTodo(todoItem, selectedPost, true);
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setTodoError(
          caughtError instanceof Error
            ? caughtError.message
            : "Todoの追加に失敗しました。",
        );
      } finally {
        setTodoSavingId(null);
      }
    },
    [
      accessToken,
      handleAuthError,
      selectedPost,
      selectedPostCanEdit,
      syncCrossMemoTodo,
      syncPostTodoItems,
      withAuthRetry,
    ],
  );

  const handleUpdateTodoItem = useCallback(
    async (
      todoItem: MobileTodoItem,
      payload: {
        completed?: boolean;
        dueAt?: string | null;
        reminderAt?: string | null;
        text?: string;
      },
    ) => {
      if (!accessToken || !selectedPost) {
        setLoginError("ログインが必要です。");
        return;
      }

      if (!selectedPostCanEdit) {
        setTodoError("このメモを編集する権限がありません。");
        return;
      }

      setTodoSavingId(todoItem.id);
      setTodoError("");

      try {
        const updatedTodoItem = await withAuthRetry((token) =>
          updateMobileTodoItem(token, selectedPost.id, todoItem.id, payload),
        );
        syncPostTodoItems(selectedPost.id, (todoItems) =>
          todoItems.map((currentTodo) =>
            currentTodo.id === updatedTodoItem.id ? updatedTodoItem : currentTodo,
          ),
        );
        syncCrossMemoTodo(updatedTodoItem, selectedPost, true);
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setTodoError(
          caughtError instanceof Error
            ? caughtError.message
            : "Todoの更新に失敗しました。",
        );
      } finally {
        setTodoSavingId(null);
      }
    },
    [
      accessToken,
      handleAuthError,
      selectedPost,
      selectedPostCanEdit,
      syncCrossMemoTodo,
      syncPostTodoItems,
      withAuthRetry,
    ],
  );

  const handleToggleTodoItem = useCallback(
    (todoItem: MobileTodoItem) => {
      void handleUpdateTodoItem(todoItem, { completed: !todoItem.completed });
    },
    [handleUpdateTodoItem],
  );

  const performDeleteTodoItem = useCallback(
    async (todoItem: MobileTodoItem) => {
      if (!accessToken || !selectedPost) {
        setLoginError("ログインが必要です。");
        return;
      }

      if (!selectedPostCanEdit) {
        setTodoError("このメモを編集する権限がありません。");
        return;
      }

      setTodoSavingId(todoItem.id);
      setTodoError("");

      try {
        await withAuthRetry((token) =>
          deleteMobileTodoItem(token, selectedPost.id, todoItem.id),
        );
        syncPostTodoItems(selectedPost.id, (todoItems) =>
          todoItems.filter((currentTodo) => currentTodo.id !== todoItem.id),
        );
        removeCrossMemoTodo(todoItem.id);
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        setTodoError(
          caughtError instanceof Error
            ? caughtError.message
            : "Todoの削除に失敗しました。",
        );
      } finally {
        setTodoSavingId(null);
      }
    },
    [
      accessToken,
      handleAuthError,
      removeCrossMemoTodo,
      selectedPost,
      selectedPostCanEdit,
      syncPostTodoItems,
      withAuthRetry,
    ],
  );

  const confirmDeleteTodoItem = useCallback(
    (todoItem: MobileTodoItem) => {
      Alert.alert("Todoを削除しますか？", "削除したTodoは元に戻せません。", [
        { style: "cancel", text: "キャンセル" },
        {
          onPress: () => {
            void performDeleteTodoItem(todoItem);
          },
          style: "destructive",
          text: "削除",
        },
      ]);
    },
    [performDeleteTodoItem],
  );

  const handleToggleCrossTodo = useCallback(
    async (todoItem: MobileCrossMemoTodoItem) => {
      if (!accessToken || !todoItem.canEdit) {
        return;
      }

      setTodoSavingId(todoItem.id);
      setAllTodosError("");
      setCalendarError("");

      try {
        const updatedTodoItem = await withAuthRetry((token) =>
          updateMobileTodoItem(token, todoItem.postId, todoItem.id, {
            completed: !todoItem.completed,
          }),
        );
        const nextTodo = { ...todoItem, ...updatedTodoItem };
        setAllTodos((currentTodos) =>
          currentTodos
            .map((todo) => (todo.id === nextTodo.id ? nextTodo : todo))
            .sort(compareTodos),
        );
        setCalendarTodos((currentTodos) =>
          currentTodos
            .map((todo) => (todo.id === nextTodo.id ? nextTodo : todo))
            .sort(compareTodos),
        );
        syncPostTodoItems(todoItem.postId, (todoItems) =>
          todoItems.map((currentTodo) =>
            currentTodo.id === updatedTodoItem.id ? updatedTodoItem : currentTodo,
          ),
        );
      } catch (caughtError) {
        if (await handleAuthError(caughtError)) {
          return;
        }

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Todoの更新に失敗しました。";
        setAllTodosError(message);
        setCalendarError(message);
      } finally {
        setTodoSavingId(null);
      }
    },
    [accessToken, handleAuthError, syncPostTodoItems, withAuthRetry],
  );

  const performDelete = useCallback(async () => {
    if (!accessToken || !selectedPost) {
      setLoginError("ログインが必要です。");
      return;
    }

    if (selectedPost.accessRole !== "owner") {
      setDetailError("このメモを削除する権限がありません。");
      return;
    }

    setDeleting(true);
    setDetailError("");

    try {
      await withAuthRetry((token) =>
        deleteMobilePost(token, selectedPost.id),
      );
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
  }, [accessToken, handleAuthError, selectedPost, withAuthRetry]);

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
  const deferredQuery = useDeferredValue(query);
  const filteredPosts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return posts
      .filter((post) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          post.title.toLowerCase().includes(normalizedQuery) ||
          post.content.toLowerCase().includes(normalizedQuery) ||
          (post.todoItems ?? []).some((todoItem) =>
            todoItem.text.toLowerCase().includes(normalizedQuery),
          ) ||
          post.tags.some((tag) =>
            tag.name.toLowerCase().includes(normalizedQuery),
          );

        const matchesStatus =
          selectedFilter === "all" ||
          (selectedFilter === "mine" && post.accessRole === "owner") ||
          (selectedFilter === "shared" &&
            (post.accessRole === "viewer" || post.accessRole === "editor")) ||
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
  }, [deferredQuery, posts, selectedFilter, sortMode]);
  const visibleAllTodos = useMemo(
    () => allTodos.filter((todo) => matchesTodoFilter(todo, todoFilter)).sort(compareTodos),
    [allTodos, todoFilter],
  );
  const calendarTodosByDate = useMemo(() => {
    const groups = new Map<string, MobileCrossMemoTodoItem[]>();

    for (const todo of calendarTodos.filter((item) => item.dueAt).sort(compareTodos)) {
      if (!todo.dueAt) continue;
      const key = getCalendarDateKey(todo.dueAt);
      groups.set(key, [...(groups.get(key) ?? []), todo]);
    }

    return groups;
  }, [calendarTodos]);
  const selectedCalendarTodos = useMemo(() => {
    if (calendarQuickFilter === "today") {
      return calendarTodos
        .filter((todo) => isSameLocalDay(todo.dueAt, new Date()))
        .sort(compareTodos);
    }

    if (calendarQuickFilter === "tomorrow") {
      return calendarTodos
        .filter((todo) => isSameLocalDay(todo.dueAt, addLocalDays(new Date(), 1)))
        .sort(compareTodos);
    }

    if (calendarQuickFilter === "week") {
      return calendarTodos.filter(isTodoDueThisWeek).sort(compareTodos);
    }

    if (calendarQuickFilter === "overdue") {
      return calendarTodos.filter(isTodoOverdue).sort(compareTodos);
    }

    return (calendarTodosByDate.get(selectedCalendarDateKey) ?? []).sort(compareTodos);
  }, [
    calendarQuickFilter,
    calendarTodos,
    calendarTodosByDate,
    selectedCalendarDateKey,
  ]);
  const selectedCalendarListLabel = useMemo(() => {
    if (calendarQuickFilter) {
      return (
        calendarQuickFilters.find((filter) => filter.value === calendarQuickFilter)
          ?.label ?? "Todo"
      );
    }

    const selectedTodo = selectedCalendarTodos[0];
    if (selectedTodo?.dueAt) {
      return calendarDateFormatter.format(new Date(selectedTodo.dueAt));
    }

    return formatLocalDateKey(selectedCalendarDateKey);
  }, [calendarQuickFilter, selectedCalendarDateKey, selectedCalendarTodos]);
  const todoSummaryCounts = useMemo(
    () => ({
      active: allTodos.filter((todo) => !todo.completed).length,
      completed: allTodos.filter((todo) => todo.completed).length,
      overdue: allTodos.filter(isTodoOverdue).length,
    }),
    [allTodos],
  );
  const calendarQuickCounts = useMemo(
    () => ({
      today: calendarTodos.filter((todo) => isSameLocalDay(todo.dueAt, new Date())).length,
      tomorrow: calendarTodos.filter((todo) =>
        isSameLocalDay(todo.dueAt, addLocalDays(new Date(), 1)),
      ).length,
      week: calendarTodos.filter(isTodoDueThisWeek).length,
      overdue: calendarTodos.filter(isTodoOverdue).length,
    }),
    [calendarTodos],
  );
  const postSummaryCounts = useMemo(
    () => ({
      myMemo: posts.filter((post) => post.accessRole === "owner").length,
      private: posts.filter((post) => !post.published).length,
      published: posts.filter((post) => post.published).length,
      shared: posts.filter(
        (post) => post.accessRole === "viewer" || post.accessRole === "editor",
      ).length,
    }),
    [posts],
  );
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

  if (viewMode === "create-choice") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <NewPostChoiceScreen
          onCancel={() => setViewMode("list")}
          onSelectText={handleCreateText}
          onSelectTodo={handleCreateDueTodo}
        />
      </SafeAreaView>
    );
  }

  if (viewMode === "create-todo") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <DueTodoCreateScreen
          error={todoError}
          onCancel={handleCancelForm}
          onSubmit={(payload) => {
            void handleSaveDueTodoCreate(payload);
          }}
          saving={saving}
        />
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
            <Text style={styles.accountSettingsText}>
              通知: {pushStatusMessage || "未確認"}
            </Text>
            <Button
              disabled={pushTestLoading}
              loading={pushTestLoading}
              onPress={handleSendTestPush}
              style={styles.fullButton}
              variant="secondary"
            >
              テスト通知を送る
            </Button>
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
        <MainTabBar activeTab="account" onNavigate={navigateMainTab} />
      </SafeAreaView>
    );
  }

  if (viewMode === "edit" && selectedPost) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <MemoForm
          autoSaveError={autoSaveError}
          canChangePublished={selectedPost.accessRole === "owner"}
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

  if (viewMode === "share" && selectedPost) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <ShareSettingsScreen
          addEmail={shareEmail}
          addRole={shareRole}
          error={shareError}
          loading={shareLoading}
          message={shareMessage}
          onAddEmailChange={setShareEmail}
          onAddRoleChange={setShareRole}
          onAddShare={() => {
            void handleAddShare();
          }}
          onBack={() => setViewMode("detail")}
          onRefresh={() => {
            void loadPostShares(selectedPost.id);
          }}
          onRevokeShare={confirmRevokeShare}
          onUpdateShareRole={(share, role) => {
            void handleUpdateShareRole(share, role);
          }}
          saving={shareSaving}
          shares={postShares}
        />
      </SafeAreaView>
    );
  }

  if (viewMode === "todos") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.screen}>
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>Todos</Text>
              <Text style={styles.title}>Todo一覧</Text>
              <Text style={styles.postsSummary}>
                未完了 {todoSummaryCounts.active}件 / 期限切れ {todoSummaryCounts.overdue}件 / 完了済み {todoSummaryCounts.completed}件
              </Text>
            </View>
          </View>

          <Card style={[styles.postsControls, styles.flatSurface]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipScroll}
            >
              {todoFilters.map((filter) => (
                <Pressable
                  accessibilityRole="button"
                  key={filter.value}
                  onPress={() => setTodoFilter(filter.value)}
                  style={[
                    styles.filterChip,
                    todoFilter === filter.value ? styles.filterChipActive : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      todoFilter === filter.value
                        ? styles.filterChipTextActive
                        : undefined,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Card>

          {allTodosLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#2563eb" size="large" />
              <Text style={styles.stateText}>Todoを読み込んでいます</Text>
            </View>
          ) : allTodosError ? (
            <View style={styles.centerState}>
              <Text style={styles.errorTitle}>取得できませんでした</Text>
              <Text style={styles.errorText}>{allTodosError}</Text>
              <Button
                onPress={() => loadAllTodos()}
                style={styles.retryButton}
                variant="secondary"
              >
                再試行
              </Button>
            </View>
          ) : visibleAllTodos.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>Todoはありません</Text>
              <Text style={styles.emptyText}>
                メモ詳細から普通のTodoや期限付きTodoを追加できます。
              </Text>
            </View>
          ) : (
            <FlatList
              contentContainerStyle={styles.todoListContent}
              data={visibleAllTodos}
              keyExtractor={(item) => String(item.id)}
              onRefresh={() => loadAllTodos(true)}
              refreshing={allTodosRefreshing}
              renderItem={({ item }) => (
                <TodoItemRow
                  canEdit={item.canEdit}
                  onPress={() => {
                    void openPostDetailById(item.postId);
                  }}
                  onToggle={() => {
                    void handleToggleCrossTodo(item);
                  }}
                  postTitle={item.postTitle}
                  saving={todoSavingId === item.id}
                  todo={item}
                />
              )}
            />
          )}
        </View>
        <MainTabBar activeTab="todos" onNavigate={navigateMainTab} />
      </SafeAreaView>
    );
  }

  if (viewMode === "calendar") {
    const calendarListEmptyText = calendarQuickFilter
      ? `${selectedCalendarListLabel}の期限付きTodoはありません。`
      : "この日の期限付きTodoはありません。";

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.screen}>
          <View style={styles.compactHeader}>
            <View>
              <Text style={styles.kicker}>Calendar</Text>
              <Text style={styles.title}>カレンダー</Text>
              <Text style={styles.postsSummary}>
                今日 {calendarQuickCounts.today}件 / 明日 {calendarQuickCounts.tomorrow}件 / 今週 {calendarQuickCounts.week}件 / 期限切れ {calendarQuickCounts.overdue}件
              </Text>
            </View>
          </View>

          {calendarLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#2563eb" size="large" />
              <Text style={styles.stateText}>カレンダーを読み込んでいます</Text>
            </View>
          ) : calendarError ? (
            <View style={styles.centerState}>
              <Text style={styles.errorTitle}>取得できませんでした</Text>
              <Text style={styles.errorText}>{calendarError}</Text>
              <Button
                onPress={() => loadCalendarTodos()}
                style={styles.retryButton}
                variant="secondary"
              >
                再試行
              </Button>
            </View>
          ) : (
            <FlatList
              contentContainerStyle={styles.calendarListContent}
              data={selectedCalendarTodos}
              keyExtractor={(item) => String(item.id)}
              ListEmptyComponent={
                <View style={styles.calendarEmptySelection}>
                  <Text style={styles.emptyTitle}>{calendarListEmptyText}</Text>
                  <Text style={styles.emptyText}>
                    メモ詳細で期限付きTodoを追加すると月カレンダーに表示されます。
                  </Text>
                </View>
              }
              ListHeaderComponent={
                <View style={styles.calendarHeaderContent}>
                  <Card style={[styles.calendarQuickPanel, styles.flatSurface]}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filterChipScroll}
                    >
                      {calendarQuickFilters.map((filter) => {
                        const count = calendarQuickCounts[filter.value];

                        return (
                          <Pressable
                            accessibilityRole="button"
                            key={filter.value}
                            onPress={() => {
                              setCalendarQuickFilter((current) =>
                                current === filter.value ? null : filter.value,
                              );
                            }}
                            style={[
                              styles.filterChip,
                              calendarQuickFilter === filter.value
                                ? styles.filterChipActive
                                : undefined,
                            ]}
                          >
                            <Text
                              style={[
                                styles.filterChipText,
                                calendarQuickFilter === filter.value
                                  ? styles.filterChipTextActive
                                  : undefined,
                              ]}
                            >
                              {filter.label} {count}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </Card>

                  <CalendarMonthGrid
                    monthDate={calendarMonthDate}
                    onMonthChange={setCalendarMonthDate}
                    onSelectDate={(dateKey) => {
                      setSelectedCalendarDateKey(dateKey);
                      setCalendarQuickFilter(null);
                      const [year, month] = dateKey.split("-").map(Number);
                      if (year && month) {
                        setCalendarMonthDate(new Date(year, month - 1, 1));
                      }
                    }}
                    selectedDateKey={selectedCalendarDateKey}
                    todosByDate={calendarTodosByDate}
                  />

                  <View style={styles.calendarSelectionHeader}>
                    <Text style={styles.calendarSelectionTitle}>
                      {selectedCalendarListLabel}
                    </Text>
                    <Text style={styles.calendarGroupCount}>
                      {selectedCalendarTodos.length}件
                    </Text>
                  </View>
                </View>
              }
              onRefresh={() => loadCalendarTodos(true)}
              refreshing={calendarRefreshing}
              renderItem={({ item }) => (
                <TodoItemRow
                  canEdit={item.canEdit}
                  onPress={() => {
                    void openPostDetailById(item.postId);
                  }}
                  onToggle={() => {
                    void handleToggleCrossTodo(item);
                  }}
                  postTitle={item.postTitle}
                  saving={todoSavingId === item.id}
                  todo={item}
                />
              )}
            />
          )}
        </View>
        <MainTabBar activeTab="calendar" onNavigate={navigateMainTab} />
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
              {selectedPostCanEdit ? (
                <Button
                  disabled={!selectedPost || detailLoading || deleting}
                  onPress={handleEdit}
                  style={styles.toolButton}
                  variant="secondary"
                >
                  編集
                </Button>
              ) : null}
              {selectedPostCanManageShares ? (
                <Button
                  disabled={!selectedPost || detailLoading || deleting}
                  onPress={openShareSettings}
                  style={styles.toolButton}
                  variant="secondary"
                >
                  共有
                </Button>
              ) : null}
              {selectedPostCanDelete ? (
                <Button
                  disabled={!selectedPost || detailLoading || deleting}
                  loading={deleting}
                  onPress={confirmDelete}
                  style={styles.toolButton}
                  variant="danger"
                >
                  削除
                </Button>
              ) : null}
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
                  {selectedPost.accessRole === "viewer" ? (
                    <Badge variant="shared">viewer</Badge>
                  ) : null}
                  {selectedPost.accessRole === "editor" ? (
                    <Badge variant="shared">editor</Badge>
                  ) : null}
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
                  {isTodoListPost(selectedPost) && selectedPost.todoListDueAt ? (
                    <View style={styles.postMetaItem}>
                      <Text style={styles.postMetaLabel}>リスト期限</Text>
                      <Text style={styles.postMetaValue}>
                        {formatUpdatedAt(selectedPost.todoListDueAt)}
                      </Text>
                    </View>
                  ) : null}
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

              {isTodoListPost(selectedPost) ? (
                <PostTodoItemsPreview todoItems={selectedPost.todoItems ?? []} />
              ) : (
                <TodoContentDisplay content={selectedPost.content} />
              )}

              {(selectedPost.todoItems ?? []).length > 0 ? (
                <TodoItemsPanel
                  canEdit={selectedPostCanEdit}
                  error={todoError}
                  forceDueTodo={isTodoListPost(selectedPost)}
                  hideCreateForm
                  onCreate={(payload) => {
                    void handleCreateTodoItem(payload);
                  }}
                  onDelete={confirmDeleteTodoItem}
                  onToggle={handleToggleTodoItem}
                  onUpdate={(todo, payload) => {
                    void handleUpdateTodoItem(todo, payload);
                  }}
                  savingId={todoSavingId}
                  todoItems={selectedPost.todoItems ?? []}
                />
              ) : null}

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
        <View style={styles.compactHeader}>
          <View>
            <Text style={styles.kicker}>Memo workspace</Text>
            <View style={styles.listTitleRow}>
              <Text style={styles.title}>メモ一覧</Text>
              <Button onPress={handleCreate} style={styles.createMemoButton}>
                新規作成
              </Button>
            </View>
            <Text style={styles.postsSummary}>
              表示中 {posts.length}件 / 自分 {postSummaryCounts.myMemo}件 / 共有 {postSummaryCounts.shared}件 / 公開 {postSummaryCounts.published}件 / 非公開 {postSummaryCounts.private}件
            </Text>
          </View>
        </View>

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
              onPress={() => loadPosts()}
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
      <MainTabBar activeTab="list" onNavigate={navigateMainTab} />
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
  mainTabBar: {
    backgroundColor: colors.surfaceStrong,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingBottom: Platform.OS === "ios" ? 18 : 10,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  mainTabButton: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  mainTabButtonActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  mainTabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
  },
  mainTabTextActive: {
    color: colors.white,
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
  compactHeader: {
    marginBottom: 10,
  },
  kicker: {
    ...typography.eyebrow,
  },
  title: {
    ...typography.screenTitle,
    marginTop: 6,
  },
  listTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 2,
  },
  createMemoButton: {
    minHeight: 38,
    minWidth: 94,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  postsSummary: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 6,
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
  shareSettingsContent: {
    paddingBottom: 42,
    paddingHorizontal: spacing.lg,
    paddingTop: 22,
  },
  shareSettingsCard: {
    backgroundColor: colors.surface,
    gap: 14,
    marginBottom: 12,
    padding: 18,
  },
  shareEmailInput: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  shareRoleSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  shareRoleChip: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 38,
    minWidth: 86,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  shareRoleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  shareRoleChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
  },
  shareRoleChipTextActive: {
    color: colors.white,
  },
  shareSuccessText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
  },
  shareListHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  shareInlineLoading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  shareList: {
    gap: 12,
  },
  shareRow: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  shareUserInfo: {
    gap: 3,
  },
  shareUserName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  shareUserEmail: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  disabledControl: {
    opacity: 0.55,
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
  todoListContent: {
    gap: 12,
    paddingBottom: 110,
  },
  calendarQuickPanel: {
    marginBottom: 10,
    padding: 10,
  },
  calendarQuickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  calendarHeaderContent: {
    gap: 10,
    marginBottom: 10,
  },
  calendarListContent: {
    gap: 10,
    paddingBottom: 110,
  },
  calendarMonthPanel: {
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    padding: 10,
  },
  calendarMonthHeader: {
    gap: 10,
    marginBottom: 10,
  },
  calendarMonthTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  calendarMonthActions: {
    flexDirection: "row",
    gap: 6,
  },
  calendarMonthButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 6,
  },
  calendarMonthButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
  },
  calendarWeekdayRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
  },
  calendarWeekdayText: {
    color: colors.textSoft,
    flex: 1,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  calendarDateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  calendarDateCell: {
    aspectRatio: 0.82,
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: 5,
    width: "13.26%",
  },
  calendarDateCellMuted: {
    opacity: 0.42,
  },
  calendarDateCellToday: {
    borderColor: colors.primaryStrong,
    borderWidth: 2,
  },
  calendarDateCellSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  calendarDateCellOverdue: {
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(220, 38, 38, 0.34)",
  },
  calendarDateCellCompleted: {
    opacity: 0.58,
  },
  calendarDateNumber: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  calendarDateNumberMuted: {
    color: colors.textSoft,
  },
  calendarDateNumberSelected: {
    color: colors.white,
  },
  calendarDateCount: {
    color: colors.primaryStrong,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 3,
  },
  calendarDateCountOverdue: {
    color: colors.danger,
  },
  calendarDateCountSelected: {
    color: colors.white,
  },
  calendarDateTodoText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  calendarDateTodoTextCompleted: {
    color: colors.textSoft,
    textDecorationLine: "line-through",
  },
  calendarDateTodoTextSelected: {
    color: colors.white,
  },
  calendarSelectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  calendarSelectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  calendarEmptySelection: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  calendarGroup: {
    gap: 10,
  },
  calendarGroupHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  calendarGroupTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  calendarGroupCount: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "900",
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
  cardTodoPreviewDue: {
    color: colors.textSoft,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 20,
    maxWidth: 132,
  },
  cardTodoPreviewMore: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
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
  memoDueLabel: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    borderRadius: radius.pill,
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
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
  modelTodoPanel: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  modelTodoHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  modelTodoTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
    marginTop: 4,
  },
  modelTodoForm: {
    gap: 12,
    padding: 14,
  },
  todoKindRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modelTodoList: {
    gap: 10,
  },
  modelTodoRow: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  modelTodoRowCompleted: {
    opacity: 0.62,
  },
  modelTodoRowOverdue: {
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(220, 38, 38, 0.28)",
  },
  modelTodoMain: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  modelTodoCheckButton: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 28,
  },
  modelTodoTextBlock: {
    flex: 1,
    gap: 7,
  },
  modelTodoText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 23,
  },
  modelTodoMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  modelTodoMeta: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modelTodoMetaOverdue: {
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    color: colors.danger,
  },
  modelTodoActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  modelTodoActionButton: {
    minHeight: 36,
    minWidth: 66,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  modelTodoEditCard: {
    gap: 12,
    padding: 14,
  },
  modelTodoEditActions: {
    flexDirection: "row",
    gap: 10,
  },
  modelTodoEmpty: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },
  creationChoiceGrid: {
    gap: 12,
    marginBottom: 18,
  },
  creationChoiceCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 8,
    minHeight: 142,
    padding: 18,
  },
  creationChoiceLabel: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  creationChoiceTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 25,
  },
  creationChoiceText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },
  dateTimePicker: {
    gap: 8,
  },
  dateTimePickerLabel: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  dateTimePickerRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  dateTimePickerValue: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  dueTodoDraftItem: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 12,
    paddingTop: 12,
  },
  memoTodoSummary: {
    backgroundColor: "rgba(248, 250, 252, 0.82)",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  memoTodoSummaryRow: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  memoTodoSummaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  memoTodoSummaryMeta: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "900",
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
