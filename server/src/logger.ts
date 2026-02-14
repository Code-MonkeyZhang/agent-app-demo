import winston from 'winston';
import path from 'path';
import { createWriteStream } from 'fs';
import { promises as fsPromises } from 'fs';
import { ClientLogEntry } from './types.js';

const logDir = path.join(process.cwd(), 'logs');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level}] ${message}`;
  })
);

export const serverLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: consoleFormat,
  transports: [
    new winston.transports.Console(),
  ],
});

export class ConnectionLogger {
  private logger: winston.Logger;
  private connId: string;
  private logFilePath: string;

  constructor(connId: string) {
    this.connId = connId;
    this.logFilePath = path.join(logDir, `${connId}.log`);
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports: [
        new winston.transports.File({
          filename: this.logFilePath,
        }),
      ],
    });

    this.info('Connection started');
    serverLogger.info(`[WS] Connection started: ${connId} -> ${this.logFilePath}`);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  close(): void {
    this.info('Connection closed');
    this.logger.end();
    serverLogger.info(`[WS] Connection closed: ${this.connId}`);
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}

export class ClientLogger {
  private clientLogPath: string;
  private connId: string;

  constructor(connId: string) {
    this.connId = connId;
    this.clientLogPath = path.join(logDir, `client-${connId}.log`);
    serverLogger.info(`[WS] Client logger created: ${this.clientLogPath}`);
  }

  async saveLogs(logs: ClientLogEntry[]): Promise<void> {
    try {
      const logLines = logs.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      await fsPromises.appendFile(this.clientLogPath, logLines);
      serverLogger.info(`[WS] Saved ${logs.length} client logs to ${this.clientLogPath}`);
    } catch (error) {
      serverLogger.error(`[WS] Failed to save client logs:`, error);
    }
  }

  getLogFilePath(): string {
    return this.clientLogPath;
  }
}

export default serverLogger;
