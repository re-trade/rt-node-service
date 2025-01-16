import EnvLoader, { TEnvValidatorKeyMap } from "../helpers/env-loader.js"

type TSeaEnvironment = {
    NODE_ENV: 'development' | 'production',
    PORT: number,
    USER_API_URL: string
}
const validators: TEnvValidatorKeyMap<TSeaEnvironment> = {
    NODE_ENV: { required: true, default: 'development' },
    PORT: { required: true, default: 3000 },
    USER_API_URL: { required: false }
};
const configLoader = new EnvLoader<TSeaEnvironment>(validators);

export default configLoader;