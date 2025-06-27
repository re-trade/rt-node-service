import EnvLoader, { TEnvValidatorKeyMap } from '../helpers/env-loader.js';

type TRetradeEnvironment = {
  NODE_ENV: 'development' | 'production';
  PORT: number;
  CORS_ORIGIN: string;
  JWT_SECRET: string;
  REDIS_URL: string;
  SOCKET_PORT: number;
  DATABASE_URL: string;
};
const validators: TEnvValidatorKeyMap<TRetradeEnvironment> = {
  NODE_ENV: { required: true, default: 'development' },
  PORT: { required: true, default: 3000 },
  CORS_ORIGIN: { required: true, default: 'http://localhost:3000' },
  JWT_SECRET: { required: true, default: 'your-secret-key' },
  REDIS_URL: { required: false, default: 'redis://localhost:6379' },
  SOCKET_PORT: { required: true, default: 3001 },
  DATABASE_URL: { required: true, default: 'postgresql://localhost:5432/retrade' },
};
const configLoader = new EnvLoader<TRetradeEnvironment>(validators);

export default configLoader;
