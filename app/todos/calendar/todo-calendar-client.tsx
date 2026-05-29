"use client";

import Link from "next/link";
import { useState } from "react";
import {
  addLocalDays,
  addLocalMonths,
  filterCalendarTodos,
  getCalendarDayGroups,
  getCalendarMonthDays,
  getCalendarMonthLabel,
  getCalendarDueTimeLabel,
  getOverdueCalendarTodos,
  getMonthRange,
  getWeekRange,
  toLocalDateKey,
  type CalendarFilter,
  type CalendarTodo,
  type CalendarViewMode,
} from "@/components/todo-calendar-utils";
import { getTodoReminderDisplay } from "@/components/todo-items-utils";

type TodoCalendarClientProps = {
  initialViewMode: CalendarViewMode;
  nowIso: string;
  periodStartIso: string;
  todos: CalendarTodo[];
};

const rangeFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "2-digit",
  day: "2-digit",
});

function getTodoHref(todo: CalendarTodo) {
  return todo.canEdit ? `/posts/${todo.postId}/edit` : `/posts/${todo.postId}`;
}

function getCalendarHref(viewMode: CalendarViewMode, start: Date) {
  const params = new URLSearchParams();
  params.set("view", viewMode);
  params.set("start", toLocalDateKey(start));
  return `/todos/calendar?${params.toString()}`;
}

function TodoCalendarItem({
  compact = false,
  nowTime,
  todo,
}: {
  compact?: boolean;
  nowTime: number;
  todo: CalendarTodo;
}) {
  const isOverdue = !todo.completed && new Date(todo.dueAt).getTime() < nowTime;
  const reminderDisplay = getTodoReminderDisplay(
    todo.reminderAt,
    todo.reminderSentAt,
    todo.completed,
    nowTime,
  );

  return (
    <li
      className={[
        "todo-calendar__item",
        todo.completed ? "todo-calendar__item--completed" : "",
        isOverdue ? "todo-calendar__item--overdue" : "",
        compact ? "todo-calendar__item--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Link href={getTodoHref(todo)}>
        <span className="todo-calendar__time">{getCalendarDueTimeLabel(todo.dueAt)}</span>
        <span className="todo-calendar__item-body">
          <span className="todo-calendar__todo-text">{todo.text}</span>
          <span className="todo-calendar__todo-meta">
            <span>{todo.postTitle}</span>
            {isOverdue && <span className="todo-calendar__overdue-label">期限切れ</span>}
            {todo.reminderAt && (
              <span className="todo-calendar__overdue-label">
                {reminderDisplay.label}
              </span>
            )}
            {!todo.canEdit && <span className="memo-badge">閲覧のみ</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function TodoCalendarClient({
  initialViewMode,
  nowIso,
  periodStartIso,
  todos,
}: TodoCalendarClientProps) {
  const [selectedFilter, setSelectedFilter] = useState<CalendarFilter | null>(null);
  const nowTime = new Date(nowIso).getTime();
  const periodStart = new Date(periodStartIso);
  const weekRange = getWeekRange(periodStart);
  const monthRange = getMonthRange(periodStart);
  const isMonthView = initialViewMode === "month";
  const { start, end } = isMonthView ? monthRange : weekRange;
  const periodEnd = addLocalDays(end, -1);
  const visibleTodos = filterCalendarTodos(todos, selectedFilter, nowTime);
  const dayGroups = getCalendarDayGroups(visibleTodos, start, nowTime);
  const monthDays = getCalendarMonthDays(visibleTodos, start, nowTime);
  const overdueTodos = getOverdueCalendarTodos(todos, nowTime);
  const overdueVisibleTodos =
    selectedFilter === "overdue" ? filterCalendarTodos(todos, "overdue", nowTime) : [];
  const todayCount = filterCalendarTodos(todos, "today", nowTime).length;
  const tomorrowCount = filterCalendarTodos(todos, "tomorrow", nowTime).length;
  const weekCount = filterCalendarTodos(todos, "week", nowTime).length;
  const activeCount = filterCalendarTodos(todos, "active", nowTime).length;
  const previousStart = isMonthView ? addLocalMonths(start, -1) : addLocalDays(start, -7);
  const nextStart = isMonthView ? addLocalMonths(start, 1) : addLocalDays(start, 7);
  const todayStart = new Date(nowTime);
  const todayHref = getCalendarHref(
    initialViewMode,
    isMonthView ? getMonthRange(todayStart).start : todayStart,
  );
  const rangeText = isMonthView
    ? getCalendarMonthLabel(start)
    : `${rangeFormatter.format(start)} - ${rangeFormatter.format(periodEnd)}`;
  const emptyText =
    selectedFilter === "overdue"
      ? "期限切れTodoはありません。"
      : "この期間に期限付きTodoはありません。";
  const filterOptions: { label: string; value: CalendarFilter; count: number }[] = [
    { label: "今日", value: "today", count: todayCount },
    { label: "明日", value: "tomorrow", count: tomorrowCount },
    { label: "今週", value: "week", count: weekCount },
    { label: "期限切れ", value: "overdue", count: overdueTodos.length },
    { label: "未完了のみ", value: "active", count: activeCount },
  ];

  return (
    <section className="todo-calendar" aria-label="Todoカレンダー">
      <div className="todo-calendar__toolbar">
        <div>
          <p className="todo-calendar__range-label">表示期間</p>
          <p className="todo-calendar__range">{rangeText}</p>
        </div>
        <div className="todo-calendar__controls">
          <Link
            className="todo-items__button todo-items__button--ghost"
            href={getCalendarHref(initialViewMode, previousStart)}
          >
            {isMonthView ? "前の月" : "前の週"}
          </Link>
          <Link className="todo-items__button todo-items__button--ghost" href={todayHref}>
            今日へ戻る
          </Link>
          <Link
            className="todo-items__button todo-items__button--ghost"
            href={getCalendarHref(initialViewMode, nextStart)}
          >
            {isMonthView ? "次の月" : "次の週"}
          </Link>
        </div>
      </div>

      <div className="todo-calendar__options">
        <div className="todo-calendar__view-switch" aria-label="カレンダー表示切り替え">
          <Link
            className={!isMonthView ? "todo-calendar__view-link todo-calendar__view-link--active" : "todo-calendar__view-link"}
            href={getCalendarHref("week", start)}
          >
            週表示
          </Link>
          <Link
            className={isMonthView ? "todo-calendar__view-link todo-calendar__view-link--active" : "todo-calendar__view-link"}
            href={getCalendarHref("month", getMonthRange(start).start)}
          >
            月表示
          </Link>
        </div>
        <div className="todo-calendar__chips" aria-label="期限付きTodoフィルター">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              className={[
                "todo-calendar__chip-button",
                selectedFilter === option.value ? "todo-calendar__chip-button--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              onClick={() =>
                setSelectedFilter((currentFilter) =>
                  currentFilter === option.value ? null : option.value,
                )
              }
            >
              {option.label} {option.count}
            </button>
          ))}
        </div>
      </div>

      {selectedFilter === "overdue" && overdueVisibleTodos.length > 0 && (
        <section className="todo-calendar__group todo-calendar__group--overdue">
          <header>
            <h2>期限切れ</h2>
            <span>{overdueVisibleTodos.length}</span>
          </header>
          <ul className="todo-calendar__list">
            {overdueVisibleTodos.map((todo) => (
              <TodoCalendarItem key={`overdue-${todo.id}`} nowTime={nowTime} todo={todo} />
            ))}
          </ul>
        </section>
      )}

      {selectedFilter === "overdue" ? (
        overdueVisibleTodos.length === 0 && <p className="todo-calendar__empty">{emptyText}</p>
      ) : isMonthView ? (
        <div className="todo-calendar__month" role="grid" aria-label={rangeText}>
          {["日", "月", "火", "水", "木", "金", "土"].map((weekday) => (
            <div key={weekday} className="todo-calendar__weekday" role="columnheader">
              {weekday}
            </div>
          ))}
          {monthDays.map((day) => (
            <section
              key={day.dateKey}
              className={[
                "todo-calendar__month-day",
                day.isCurrentMonth ? "" : "todo-calendar__month-day--outside",
                day.isToday ? "todo-calendar__month-day--today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              role="gridcell"
            >
              <header>
                <span>{day.label}</span>
                {day.todos.length > 0 && <strong>{day.todos.length}</strong>}
              </header>
              {day.todos.length > 0 && (
                <ul className="todo-calendar__month-list">
                  {day.todos.slice(0, 3).map((todo) => (
                    <TodoCalendarItem key={todo.id} compact nowTime={nowTime} todo={todo} />
                  ))}
                </ul>
              )}
              {day.todos.length > 3 && (
                <p className="todo-calendar__more">他 {day.todos.length - 3} 件</p>
              )}
            </section>
          ))}
        </div>
      ) : dayGroups.length > 0 ? (
        <div className="todo-calendar__groups">
          {dayGroups.map((group) => (
            <section key={group.dateKey} className="todo-calendar__group">
              <header>
                <h2>{group.label}</h2>
                <span>{group.todos.length}</span>
              </header>
              <ul className="todo-calendar__list">
                {group.todos.map((todo) => (
                  <TodoCalendarItem key={todo.id} nowTime={nowTime} todo={todo} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="todo-calendar__empty">{emptyText}</p>
      )}
    </section>
  );
}
