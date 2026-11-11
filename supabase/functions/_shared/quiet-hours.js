export function isQuietHours(settings, now = new Date()) {
  if (!settings.quiet_enabled) return false;
  const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  const current = minutes(new Intl.DateTimeFormat('en-GB', {
    timeZone: settings.timezone || 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(now));
  const start = minutes(settings.quiet_start || '22:00');
  const end = minutes(settings.quiet_end || '07:00');
  return start === end || (start < end ? current >= start && current < end : current >= start || current < end);
}

