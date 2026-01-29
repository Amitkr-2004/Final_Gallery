/**
 * Logger Service - Simplified
 * Simple winston logger without daily rotation
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * Setup logger
 * @param {object} configService - Configuration service
 * @returns {winston.Logger} Logger instance
 */
function setupLogger(configService) {
  const config = configService.getAll();
  const logsPath = path.resolve(config.storage.logsPath);

  // Ensure logs directory exists
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true });
  }

  const logger = winston.createLogger({
    level: config.logging.level || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      // File transport
      new winston.transports.File({
        filename: path.join(logsPath, 'app.log'),
        maxsize: (config.logging.maxFileSizeMB || 10) * 1024 * 1024,
        maxFiles: config.logging.maxFiles || 5
      }),
      // Console transport for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ]
  });

  return logger;
}

module.exports = {
  setupLogger
};
