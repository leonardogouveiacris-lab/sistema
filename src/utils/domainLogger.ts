import logger, { LogCategory } from './logger';

type DomainLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

type DomainLogPayload = {
  category: LogCategory;
  event: string;
  [key: string]: unknown;
};

const logByLevel = (level: DomainLogLevel, message: string, context: string, payload: DomainLogPayload) => {
  logger[level](message, context, payload);
};

export const logRealtimeEvent = (
  message: string,
  context: string,
  event: string,
  data: Record<string, unknown> = {},
  level: DomainLogLevel = 'debug'
) => {
  logByLevel(level, message, context, {
    category: LogCategory.REALTIME,
    event,
    ...data
  });
};

export const logPdfEvent = (
  message: string,
  context: string,
  event: string,
  data: Record<string, unknown> = {},
  level: DomainLogLevel = 'info'
) => {
  logByLevel(level, message, context, {
    category: LogCategory.PDF_RENDER,
    event,
    ...data
  });
};
