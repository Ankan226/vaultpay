const { PORT } = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');

connectDB()
  .then(() => app.listen(PORT, () => console.log(`VaultPay running on port ${PORT}`)))
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });