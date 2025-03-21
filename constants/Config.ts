/**
 * Application configuration
 */
export default {
  // API URL - default using localhost which works with Expo web
  API_URL: process.env.NODE_ENV === 'production' 
    ? 'https://desirabledifficult-backend.herokuapp.com' 
    : 'http://localhost:3000',
  
  // Network profiles for different environments
  NETWORK_PROFILES: {
    OFFICE: 'http://145.127.69.26:3000',  // Office network IP
    HOME: 'http://192.168.1.X:3000',      // Replace X with your home IP last digits
    LOCALHOST: 'http://localhost:3000',
    PROD: 'https://desirabledifficult-backend.herokuapp.com'
  },
  
  // Default timeout for API requests (in milliseconds)
  API_TIMEOUT: 30000, // Increased timeout for slower connections
  
  // App version
  VERSION: '0.1.0',
  
  // Storage keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'desirabledifficult_auth_token',
    USER_DATA: 'desirabledifficult_user_data',
    THEME: 'desirabledifficult_theme',
    ACTIVE_NETWORK: 'desirabledifficult_active_network'
  }
}; 