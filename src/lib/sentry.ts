import * as Sentry from '@sentry/react';
import { Capacitor } from '@capacitor/core';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry(): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: import.meta.env.MODE === 'development' ? 1.0 : 0.2,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    release: `ages-of-war@${import.meta.env.VITE_APP_VERSION || '0.0.0'}`,
    beforeSend(event) {
      const tags = { ...(event.tags ?? {}), platform: Capacitor.getPlatform(), native: Capacitor.isNativePlatform() ? 'yes' : 'no' };
      event.tags = tags;
      return event;
    },
  });
}

export function logError(error: Error, context?: Record<string, unknown>): void {
  if (!dsn) {
    console.error(error, context);
    return;
  }
  Sentry.captureException(error, { extra: context });
}

export function logMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!dsn) {
    console[level === 'error' ? 'error' : 'info'](message);
    return;
  }
  Sentry.captureMessage(message, level);
}

export function sentryBreadcrumb(eventName: string, data?: Record<string, unknown>): void {
  if (!dsn) return;
  Sentry.addBreadcrumb({
    category: 'user-action',
    message: eventName,
    data,
    level: 'info',
  });
}

export { Sentry };
