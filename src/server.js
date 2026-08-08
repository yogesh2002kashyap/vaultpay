import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import mongoose from 'mongoose';

let server;

const startServer = async () => {
  await connectDB();

  server = app.listen(config.app.port, () => {
    logger.info(`Server running in ${config.app.env} mode on port ${config.app.port}`);
  });
};

startServer();

const gracefulShutdown = () => {
  logger.info('Received shutdown signal. Shutting down gracefully...');

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed.');
        process.exit(0);
      } catch (err) {
        logger.error(`Error closing MongoDB connection: ${err.message}`);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  gracefulShutdown();
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  gracefulShutdown();
});
