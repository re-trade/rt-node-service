import EnvLoader, { TEnvValidatorKeyMap } from '../helpers/env-loader.js';

type TRetradeEnvironment = {
  NODE_ENV: 'development' | 'production';
  PORT: number;
  CORS_ORIGIN: string;
  REDIS_URL: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_SCHEMA: string;
  DATABASE_URL: string;
  MAIN_SERVICE_HOST: string;
  MAIN_SERVICE_GRPC_PORT: number;
};
const validators: TEnvValidatorKeyMap<TRetradeEnvironment> = {
  NODE_ENV: { required: true, default: 'development' },
  PORT: { required: true, default: 3000 },
  CORS_ORIGIN: { required: false, default: 'http://localhost:3000' },
  REDIS_URL: { required: false, default: 'redis://localhost:6379' },
  DATABASE_URL: { required: true, default: 'postgresql://localhost:5432/retrade' },
  DB_HOST: { required: true, default: 'localhost' },
  DB_PORT: { required: true, default: 5432 },
  DB_NAME: { required: true, default: 'retradedb' },
  DB_USER: { required: true, default: 'postgres' },
  DB_PASSWORD: { required: true, default: '' },
  DB_SCHEMA: { required: true, default: 'public' },
  MAIN_SERVICE_HOST: { required: false, default: 'localhost' },
  MAIN_SERVICE_GRPC_PORT: { required: false, default: 9080 },
};

const configLoader = new EnvLoader<TRetradeEnvironment>(validators, env => {
  env.DATABASE_URL =
    env.DATABASE_URL ||
    `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}?schema=${env.DB_SCHEMA}`;
  return env;
});

export default configLoader;
