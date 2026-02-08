const isProduction = import.meta.env.PROD;

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

class Logger {
  info(_message: string, _context?: string, _data?: unknown): void {
    // Disabled in production
  }

  success(_message: string, _context?: string, _data?: unknown): void {
    // Disabled in production
  }

  warn(_message: string, _context?: string, _data?: unknown): void {
    // Disabled in production
  }

  error(message: string, error?: Error, context?: string): void {
    if (isProduction) return;

    const contextStr = context ? `[${context}] ` : '';
    console.error(`${contextStr}${message}`, error || '');
  }

  errorWithException(message: string, exception: Error, context?: string): void {
    this.error(message, exception, context);
  }
}

const logger = new Logger();

export default logger;
export const { info, success, warn, error, errorWithException } = logger;
