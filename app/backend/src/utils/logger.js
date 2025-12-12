// app/src/utils/logger.js
/**
 * Centralized logging utility for structured logging
 * Provides consistent log formatting across the application
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// Get log level from environment, default to INFO
const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

const LEVEL_PRIORITY = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

function shouldLog(level) {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[CURRENT_LOG_LEVEL];
}

function formatLog(level, context, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    context,
    message
  };
  
  // Add additional data if provided
  if (Object.keys(data).length > 0) {
    logEntry.data = data;
  }
  
  return JSON.stringify(logEntry);
}

class Logger {
  constructor(context) {
    this.context = context;
  }

  error(message, data = {}) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(formatLog(LOG_LEVELS.ERROR, this.context, message, data));
    }
  }

  warn(message, data = {}) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(formatLog(LOG_LEVELS.WARN, this.context, message, data));
    }
  }

  info(message, data = {}) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(formatLog(LOG_LEVELS.INFO, this.context, message, data));
    }
  }

  debug(message, data = {}) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(formatLog(LOG_LEVELS.DEBUG, this.context, message, data));
    }
  }
}

export function createLogger(context) {
  return new Logger(context);
}

export default Logger;
