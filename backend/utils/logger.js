const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, errors } = format;

// Custom format to automatically redact PII from logs
const redactPii = format((info) => {
  const redact = (text) => {
    if (typeof text !== 'string') return text;
    return text
      // Redact email addresses
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/g, '[REDACTED_EMAIL]')
      // Redact Kenyan phone numbers (+254... or 07... or 01...)
      .replace(/(?:\+254|254|0)(7|1)\d{8}/g, '[REDACTED_PHONE]')
      // Redact SHA/PPB/DDC drug & health codes
      .replace(/(?:SHA|PPB|DDC)-\d+/gi, '[REDACTED_CODE]')
      // Redact sql bind params or assignments containing IDs
      .replace(/(?:national_id|sha_number|emirates_id|passport_number)\s*[:=]\s*['"]?[^'",\s}]+['"]?/gi, (match) => {
        const parts = match.split(/[:=]/);
        return `${parts[0]}:"[REDACTED_ID]"`;
      });
  };

  if (info.message) info.message = redact(info.message);
  if (info.stack) info.stack = redact(info.stack);
  return info;
});

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    redactPii(),
    logFormat
  ),
  transports: [
    new transports.Console({
      format: combine(colorize(), logFormat)
    }),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

module.exports = logger;
