/**
 * Input validation middleware
 */

const { validateRequired, isValidEmail, sanitizeString, validateRange } = require('../utils/inputValidator');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Middleware to validate required fields
 */
const validateRequiredFields = (fields) => {
  return asyncHandler((req, res, next) => {
    const validation = validateRequired(req, fields);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        requestId: req.id
      });
    }
    next();
  });
};

/**
 * Middleware to validate email format
 */
const validateEmail = (fieldName = 'email') => {
  return asyncHandler((req, res, next) => {
    const email = req.body[fieldName];
    if (email && !isValidEmail(email)) {
      return res.status(400).json({
        error: `Invalid email format for field: ${fieldName}`,
        requestId: req.id
      });
    }
    next();
  });
};

/**
 * Middleware to sanitize string inputs
 */
const sanitizeInputs = (fields) => {
  return (req, res, next) => {
    for (const field of fields) {
      if (req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = sanitizeString(req.body[field]);
      }
    }
    next();
  };
};

/**
 * Middleware to validate numeric range
 */
const validateNumericRange = (fieldName, min, max) => {
  return asyncHandler((req, res, next) => {
    const value = req.body[fieldName];
    if (value !== undefined && !validateRange(value, min, max)) {
      return res.status(400).json({
        error: `${fieldName} must be between ${min} and ${max}`,
        requestId: req.id
      });
    }
    next();
  });
};

module.exports = {
  validateRequiredFields,
  validateEmail,
  sanitizeInputs,
  validateNumericRange
};


