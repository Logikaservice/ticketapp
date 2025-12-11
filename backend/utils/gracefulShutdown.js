/**
 * Graceful shutdown handler
 */

const gracefulShutdown = (server, pools = []) => {
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      console.log('✅ HTTP server closed');
    });

    // Close database connections
    for (const pool of pools) {
      if (pool && typeof pool.end === 'function') {
        try {
          await pool.end();
          console.log('✅ Database pool closed');
        } catch (err) {
          console.error('❌ Error closing database pool:', err);
        }
      }
    }

    // Give connections time to close
    setTimeout(() => {
      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    }, 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions more gracefully
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    shutdown('uncaughtException');
  });
};

module.exports = gracefulShutdown;

