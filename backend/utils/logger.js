/**
 * Structured logging utility
 */

const logLevels = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const getTimestamp = () => {
  return new Date().toISOString();
};

const formatLog = (level, message, metadata = {}) => {
  return {
    timestamp: getTimestamp(),
    level,
    message,
    ...metadata
  };
};

const logger = {
  error: (message, metadata = {}) => {
    const log = formatLog(logLevels.ERROR, message, metadata);
    console.error(JSON.stringify(log));
  },

  warn: (message, metadata = {}) => {
    const log = formatLog(logLevels.WARN, message, metadata);
    console.warn(JSON.stringify(log));
  },

  info: (message, metadata = {}) => {
    const log = formatLog(logLevels.INFO, message, metadata);
    console.log(JSON.stringify(log));
  },

  debug: (message, metadata = {}) => {
    if (process.env.NODE_ENV === 'development') {
      const log = formatLog(logLevels.DEBUG, message, metadata);
      console.log(JSON.stringify(log));
    }
  }
};

module.exports = logger;


