import { memo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "now", "5m", "3h", "2d"; older than a week → "Mar 3" (or "Mar 3, 2024" in another year). */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, now - t);
  if (diff < MINUTE) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  const d = new Date(t);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date(now).getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

interface RelativeTimeProps {
  iso: string;
  style?: StyleProp<TextStyle>;
}

/** Static (no ticking timer — cheap in long lists); refreshes whenever the row re-renders. */
export const RelativeTime = memo(function RelativeTime({ iso, style }: RelativeTimeProps) {
  const d = new Date(iso);
  return (
    <Text style={style} accessibilityLabel={Number.isNaN(d.getTime()) ? undefined : d.toLocaleString()}>
      {formatRelativeTime(iso)}
    </Text>
  );
});
