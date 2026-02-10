const isProduction = import.meta.env.PROD;

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

export type LogContext = string;
export type LogData = Record<string, unknown> | unknown;
export type LogError = unknown;

class Logger {
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    data?: LogData,
    error?: LogError
  ): void {
    if (isProduction) return;

    const contextStr = context ? `[${context}] ` : '';
    const formattedMessage = `${contextStr}${message}`;
    const extra: unknown[] = [];

    if (data !== undefined) {
      extra.push(data);
    }

    if (error !== undefined) {
      extra.push(error);
    }

    switch (level) {
      case LogLevel.INFO:
        console.info(formattedMessage, ...extra);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...extra);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, ...extra);
        break;
      case LogLevel.SUCCESS:
        console.log(formattedMessage, ...extra);
        break;
      default:
        console.log(formattedMessage, ...extra);
        break;
    }
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
export const info = logger.info.bind(logger);
export const success = logger.success.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);
export const errorWithException = logger.errorWithException.bind(logger);
