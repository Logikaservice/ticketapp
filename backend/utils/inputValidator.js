/**
 * Input validation utilities
 */

/**
 * Validates email format
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Validates required fields in request body
 */
const validateRequired = (req, fields) => {
  const missing = [];
  for (const field of fields) {
    if (!req.body[field] || (typeof req.body[field] === 'string' && !req.body[field].trim())) {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missing.join(', ')}`
    };
  }
  return { valid: true };
};

/**
 * Sanitizes string input to prevent XSS
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim()
    .substring(0, 10000); // Limit length
};

/**
 * Validates numeric range
 */
const validateRange = (value, min, max) => {
  const num = Number(value);
  if (isNaN(num)) return false;
  return num >= min && num <= max;
};

module.exports = {
  isValidEmail,
  validateRequired,
  sanitizeString,
  validateRange
};


