export const MEMO_LIST_PAGE_SIZE = 24;
export const MEMO_LIST_MAX_LIMIT = 120;
export const TODO_LIST_PAGE_SIZE = 80;
export const TODO_LIST_MAX_LIMIT = 240;
export const MOBILE_MEMO_LIST_LIMIT = 30;
export const MOBILE_TODO_LIST_LIMIT = 100;
export const MOBILE_CALENDAR_TODO_LIMIT = 180;
export const MEMO_CONTENT_PREVIEW_CHARS = 900;
export const TODO_ITEM_PREVIEW_LIMIT = 5;

export function resolveListLimit(
  value: string | string[] | null | undefined,
  defaultLimit: number,
  maxLimit: number,
) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return defaultLimit;
  }

  return Math.min(parsedValue, maxLimit);
}

export function getNextListLimit(
  currentLimit: number,
  pageSize: number,
  maxLimit: number,
) {
  return Math.min(currentLimit + pageSize, maxLimit);
}

export function createMemoPreview(content: string) {
  const normalizedContent = content.trim();

  if (normalizedContent.length <= MEMO_CONTENT_PREVIEW_CHARS) {
    return {
      content: normalizedContent,
      isTruncated: false,
    };
  }

  return {
    content: normalizedContent.slice(0, MEMO_CONTENT_PREVIEW_CHARS).trimEnd(),
    isTruncated: true,
  };
}
