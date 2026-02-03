import { config } from 'dotenv';

config();

export const env = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  API_URL: process.env.API_URL || 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || './data/fingerprint.db',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '7d',

  // Email
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'gmail',
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'Teste de Proficiência',
  EMAIL_FROM_EMAIL: process.env.EMAIL_FROM_EMAIL || process.env.EMAIL_USER || 'noreply@fingerprinttest.com',
  
  // SMTP Configuration (for Yahoo and custom providers)
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',

  // Paths
  IMAGE_SOURCE_PATH: process.env.IMAGE_SOURCE_PATH || './data/images',
  SAMPLES_PATH: process.env.SAMPLES_PATH || './data/samples',

  // External Data Paths
  FINGERPRINT_IMAGES_BASE: process.env.FINGERPRINT_IMAGES_BASE || '/media/DRAGONSTONE/MEGAsync/Forense/Papiloscopia/Compara_Metodos_Automaticos/Bases_de_Dados',
  FINGERPRINT_IMAGES_DIR_0: process.env.FINGERPRINT_IMAGES_DIR_0 || 'FP_gen_0',
  FINGERPRINT_IMAGES_DIR_1: process.env.FINGERPRINT_IMAGES_DIR_1 || 'FP_gen_1',

  // Image Processing
  IMAGE_WIDTH: parseInt(process.env.IMAGE_WIDTH || '712', 10),
  IMAGE_HEIGHT: parseInt(process.env.IMAGE_HEIGHT || '855', 10),
  DEGRADATION_MIN_AREA_PERCENT: parseInt(process.env.DEGRADATION_MIN_AREA_PERCENT || '10', 10),
  DEGRADATION_MAX_AREA_PERCENT: parseInt(process.env.DEGRADATION_MAX_AREA_PERCENT || '25', 10),
  DEGRADATION_MIN_ECCENTRICITY: parseFloat(process.env.DEGRADATION_MIN_ECCENTRICITY || '0.1'),
  DEGRADATION_MAX_ECCENTRICITY: parseFloat(process.env.DEGRADATION_MAX_ECCENTRICITY || '0.5'),

  // Sample Generation
  HAS_SAME_SOURCE_PROBABILITY: parseFloat(process.env.HAS_SAME_SOURCE_PROBABILITY || '0.85'),
  GROUPS_PER_SAMPLE: parseInt(process.env.GROUPS_PER_SAMPLE || '10', 10),
  IMAGES_PER_GROUP: parseInt(process.env.IMAGES_PER_GROUP || '11', 10),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || './logs/app.log',

  // Security
  RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW || '15m',
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  CSRF_TOKEN_EXPIRATION: process.env.CSRF_TOKEN_EXPIRATION || '1h',

  // Participant Settings
  VOLUNTARY_CODE_LENGTH: parseInt(process.env.VOLUNTARY_CODE_LENGTH || '6', 10),
  CARRY_CODE_LENGTH: parseInt(process.env.CARRY_CODE_LENGTH || '5', 10),
  SAMPLE_EXPIRATION_DAYS: parseInt(process.env.SAMPLE_EXPIRATION_DAYS || '120', 10),

  // CSV Configuration
  PAIRWISE_COMPARISONS_FILE: process.env.PAIRWISE_COMPARISONS_FILE || './data/pairwise_comparisons_prod.csv',

  // Helper functions for paths
  getFingerprintImagesPath: (dirIndex: 0 | 1): string => {
    const base = process.env.FINGERPRINT_IMAGES_BASE || '/media/DRAGONSTONE/MEGAsync/Forense/Papiloscopia/Compara_Metodos_Automaticos/Bases_de_Dados';
    const dir = dirIndex === 0 
      ? (process.env.FINGERPRINT_IMAGES_DIR_0 || 'FP_gen_0') 
      : (process.env.FINGERPRINT_IMAGES_DIR_1 || 'FP_gen_1');
    return `${base}/${dir}`;
  },
};

export function validateEnv(): void {
  const requiredEnvVars = [
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'JWT_SECRET',
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length > 0) {
    console.warn(
      `⚠️  Missing environment variables: ${missingEnvVars.join(', ')}`
    );
    if (env.NODE_ENV === 'production') {
      throw new Error(
        `Missing required environment variables: ${missingEnvVars.join(', ')}`
      );
    }
  }
}
