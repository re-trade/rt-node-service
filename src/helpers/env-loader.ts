import { config, DotenvConfigOptions } from 'dotenv';

type TEnvKeyType<DataType, K extends keyof DataType> = DataType[K];

type TEnvKeyMap<DataType> = {
    [Property in keyof DataType]: TEnvKeyType<DataType, Property>;
}

const envConfigOptionLoader = (option?: DotenvConfigOptions): void => {
    if (option) {
        config(option);
    }
    config();
}

export class EnvLoader<T extends {}> {
    private env: TEnvKeyMap<T> = {} as TEnvKeyMap<T>;

    constructor(postProcess?: (env: TEnvKeyMap<T>) => TEnvKeyMap<T>) {
        envConfigOptionLoader();
        const envList = process?.env;

        if (!envList) {
            throw new Error(`Can't load config`);
        }
        for (const key in envList) {
            if (envList.hasOwnProperty(key)) {
                const value = envList[key];
                if (value !== undefined) {
                    this.env[key as keyof T] = value as TEnvKeyType<T, keyof T>;
                    console.log(`Add ENV with name ${key}: Success`);
                } else {
                    console.log(`ENV variable ${key} is undefined`);
                }
            }
        }

        if (postProcess) {
            this.env = postProcess(this.env);
        }
    }

    public get config() {
        return new Proxy(this.env, {
            get: <K extends keyof T>(target: T, prop: string | symbol) => {
                if (prop in target) {
                    return target[prop as K];
                } else {
                    throw new Error(`Can't get the env value because it doesn't exist`);
                }
            }
        });
    }
}

export default EnvLoader;
