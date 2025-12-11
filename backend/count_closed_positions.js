const { dbAll } = require('./crypto_db');

(async () => {
    try {
        const result = await dbAll(
            "SELECT COUNT(*) as count FROM open_positions WHERE status IN ('closed', 'stopped', 'taken')"
        );
        console.log(result[0]?.count || 0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();

