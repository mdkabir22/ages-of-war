type TelemetryPayload = Record<string, string | number | boolean>;

const STORAGE_KEY = 'ages_of_war_telemetry_events';
const MAX_EVENTS = 250;

export function trackEvent(event: string, payload: TelemetryPayload = {}): void {
  const entry = {
    event,
    payload,
    ts: Date.now(),
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const events = raw ? (JSON.parse(raw) as Array<typeof entry>) : [];
    events.push(entry);
    if (events.length > MAX_EVENTS) {
      events.splice(0, events.length - MAX_EVENTS);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Ignore telemetry storage failures.
  }

  // Keep console trace for debugging and product tuning during launch.
  console.debug('[telemetry]', entry);
}
