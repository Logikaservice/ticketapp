// utils/passwordUtils.js

const bcrypt = require('bcrypt');

// Configurazione bcrypt
const SALT_ROUNDS = 12;

/**
 * Hasha una password in chiaro
 * @param {string} plainPassword - Password in chiaro
 * @returns {Promise<string>} - Password hashata
 */
const hashPassword = async (plainPassword) => {
  try {
    const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    console.error('❌ Errore hash password:', error);
    throw new Error('Errore durante l\'hash della password');
  }
};

/**
 * Verifica una password contro l'hash
 * @param {string} plainPassword - Password in chiaro
 * @param {string} hashedPassword - Password hashata
 * @returns {Promise<boolean>} - True se la password è corretta
 */
const verifyPassword = async (plainPassword, hashedPassword) => {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('❌ Errore verifica password:', error);
    return false;
  }
};

/**
 * Verifica se una password è già hashata (inizia con $2b$)
 * @param {string} password - Password da verificare
 * @returns {boolean} - True se è già hashata
 */
const isPasswordHashed = (password) => {
  return password && password.startsWith('$2b$');
};

/**
 * Migra una password in chiaro a hash (per compatibilità)
 * @param {string} plainPassword - Password in chiaro
 * @returns {Promise<string>} - Password hashata
 */
const migratePassword = async (plainPassword) => {
  if (isPasswordHashed(plainPassword)) {
    // Se è già hashata, restituisci così com'è
    return plainPassword;
  }
  // Se è in chiaro, hashala
  return await hashPassword(plainPassword);
};

module.exports = {
  hashPassword,
  verifyPassword,
  isPasswordHashed,
  migratePassword
};
