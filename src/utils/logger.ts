const isProduction = import.meta.env.PROD;

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

export enum LogCategory {
  UI = 'ui',
  REALTIME = 'realtime',
  NETWORK = 'network',
  PDF_RENDER = 'pdf-render',
  STORAGE = 'storage',
  USER_ACTION = 'user-action'
}

export type LogContext = string;
export type LogData = Record<string, unknown> | unknown;
export type LogError = unknown;

class Logger {
  private readonly minLevel: LogLevel;
  private readonly consoleEnabled: boolean;

  constructor() {
    this.minLevel = this.resolveMinLevel();
    this.consoleEnabled = this.resolveConsoleEnabled();
  }

  private resolveMinLevel(): LogLevel {
    const configuredLevel = import.meta.env.VITE_LOG_LEVEL?.toUpperCase();

    if (configuredLevel && configuredLevel in LOG_LEVEL_ENV_MAP) {
      return LOG_LEVEL_ENV_MAP[configuredLevel];
    }

    return isProduction ? LogLevel.WARN : LogLevel.DEBUG;
  }

  private resolveConsoleEnabled(): boolean {
    const envValue = import.meta.env.VITE_ENABLE_CONSOLE_LOGS;

    if (envValue === undefined) {
      return true;
    }

    return envValue.toLowerCase() !== 'false';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private emitToRemoteCollector(
    level: LogLevel,
    message: string,
    context?: LogContext,
    data?: LogData,
    error?: LogError
  ): void {
    // Future integration point for remote log collection (Sentry, Datadog, etc.).
    void level;
    void message;
    void context;
    void data;
    void error;
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    data?: LogData,
    error?: LogError
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const contextStr = context ? `[${context}] ` : '';
    const formattedMessage = `${contextStr}${message}`;
    const extra: unknown[] = [];

    if (data !== undefined) {
      extra.push(data);
    }

    if (error !== undefined) {
      extra.push(error);
    }

    this.emitToRemoteCollector(level, message, context, data, error);

    if (!this.consoleEnabled) {
      return;
    }

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, ...extra);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, ...extra);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...extra);
        break;
      case LogLevel.ERROR:
        console.log(`[ERROR] ${formattedMessage}`, ...extra);
        break;
      case LogLevel.SUCCESS:
        console.log(formattedMessage, ...extra);
        break;
      default:
        console.log(formattedMessage, ...extra);
        break;
    }
  }

  debug(message: string, context?: LogContext, data?: LogData): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  info(message: string, context?: LogContext, data?: LogData): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  success(message: string, context?: LogContext, data?: LogData): void {
    this.log(LogLevel.SUCCESS, message, context, data);
  }

  warn(message: string, context?: LogContext, data?: LogData): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  error(message: string, context?: LogContext, data?: LogData, error?: LogError): void {
    this.log(LogLevel.ERROR, message, context, data, error);
  }

  errorWithException(message: string, exception: Error, context?: LogContext, data?: LogData): void {
    this.error(message, context, data, exception);
  }
}

const logger = new Logger();

export default logger;
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const success = logger.success.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);
export const errorWithException = logger.errorWithException.bind(logger);
