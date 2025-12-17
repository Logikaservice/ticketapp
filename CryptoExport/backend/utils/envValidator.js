/**
 * Environment variable validation
 */

const requiredEnvVars = [
  'DATABASE_URL'
];

const optionalEnvVars = {
  'PORT': '3001',
  'NODE_ENV': 'development',
  'EMAIL_USER': null,
  'EMAIL_PASSWORD': null,
  'JWT_SECRET': null,
  'FRONTEND_URL': null
};

const validateEnv = () => {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check optional variables and provide defaults
  for (const [envVar, defaultValue] of Object.entries(optionalEnvVars)) {
    if (!process.env[envVar]) {
      if (defaultValue !== null) {
        process.env[envVar] = defaultValue;
      } else {
        warnings.push(envVar);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (warnings.length > 0) {
    console.warn(`⚠️ Optional environment variables not set: ${warnings.join(', ')}`);
  }

  return true;
};

module.exports = { validateEnv };


