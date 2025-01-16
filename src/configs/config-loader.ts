import EnvLoader from "../helpers/env-loader.js"

type TSeaEnvironment = {
    NODE_ENV: 'development' | 'production',
    PORT: number,
    USER_API_URL: string
}

const configLoader = new EnvLoader<TSeaEnvironment>();

export default configLoader;