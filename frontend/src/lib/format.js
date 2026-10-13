// עיצוב ערכים לתצוגה.

// מחזיר את ראשי התיבות של משתמש.
export function initials(user) {
  return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
}

// מחזיר שם פרטי ושם משפחה.
export function fullName(user) {
  return `${user.firstName} ${user.lastName}`;
}

// בוחר צבע טקסט קריא על רקע נתון.
export function contrastTextColor(hexColor) {
  const hex = hexColor.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.substring(i, i + 2), 16) / 255);
  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.179 ? '#000000' : '#FFFFFF';
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const DATE_SHORT_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const DATETIME_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

// מעצב תאריך מלא.
export function formatDate(iso) {
  if (!iso) return '—';
  return DATE_FMT.format(new Date(iso));
}

// מעצב תאריך קצר.
export function formatDateShort(iso) {
  if (!iso) return '—';
  return DATE_SHORT_FMT.format(new Date(iso));
}

// מעצב תאריך ושעה.
export function formatDateTime(iso) {
  if (!iso) return '—';
  return DATETIME_FMT.format(new Date(iso));
}

// מעצב זמן יחסי, כמו "לפני 3 ימים".
export function formatRelativeToNow(iso, referenceNow) {
  const diffMs = new Date(iso).getTime() - referenceNow.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffMinutes) < 60) {
    if (diffMinutes === 0) return 'just now';
    return diffMinutes > 0 ? `in ${diffMinutes} min` : `${Math.abs(diffMinutes)} min ago`;
  }
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
  }
  return diffDays > 0 ? `in ${diffDays}d` : `${Math.abs(diffDays)}d ago`;
}

// מעצב גודל קובץ.
export function formatFileSize(sizeKb) {
  if (sizeKb < 1024) return `${sizeKb} KB`;
  return `${(sizeKb / 1024).toFixed(1)} MB`;
}

// מעצב מספר שעות.
export function formatHours(hours) {
  if (hours === null || hours === undefined) return '—';
  return `${hours}h`;
}

// מחזיר את מספר הימים בין שני תאריכים.
export function daysBetween(from, to) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
}
