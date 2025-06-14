import { config, DotenvConfigOptions } from 'dotenv';

type TEnvKeyType<DataType, K extends keyof DataType> = DataType[K];

type TEnvKeyMap<DataType> = {
  [Property in keyof DataType]: TEnvKeyType<DataType, Property>;
};

export type TEnvValidator<DataType, K extends keyof DataType> = {
  required: boolean;
  default?: TEnvKeyType<DataType, K>;
};

export type TEnvValidatorKeyMap<DataType> = {
  [Property in keyof DataType]: TEnvValidator<DataType, Property>;
};
const envConfigOptionLoader = (option?: DotenvConfigOptions): void => {
  if (option) {
    config(option);
  }
  config();
};

export class EnvLoader<T extends {}> {
  private env: TEnvKeyMap<T> = {} as TEnvKeyMap<T>;

  constructor(
    validators: TEnvValidatorKeyMap<T>,
    postProcess?: (env: TEnvKeyMap<T>) => TEnvKeyMap<T>
  ) {
    envConfigOptionLoader();
    const envList = process?.env;

    if (!envList) {
      throw new Error(`Can't load config`);
    }

    for (const key in validators) {
      if (validators.hasOwnProperty(key)) {
        const validator = validators[key];
        const value = envList[key];

        if (value !== undefined && value !== '') {
          this.env[key as keyof T] = value as TEnvKeyType<T, keyof T>;
          console.log(`Environment variable "${key}" loaded successfully.`);
        } else {
          if (validator.required) {
            throw new Error(`Required environment variable "${key}" is missing.`);
          } else {
            if (validator.default !== undefined) {
              this.env[key as keyof T] = validator.default as TEnvKeyType<T, keyof T>;
              console.log(`Environment variable "${key}" is missing. Using default value.`);
            } else {
              console.log(`Environment variable "${key}" is missing, and no default value is set.`);
            }
          }
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
      },
    });
  }
}

export default EnvLoader;
