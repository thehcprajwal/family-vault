import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { DEFAULT_REGION, DEFAULT_STAGE } from './app-config';

let isLoaded = false;

export interface InfraEnvironment {
  account?: string;
  region: string;
  stage: string;
}

export function loadInfraEnvironment(): InfraEnvironment {
  if (!isLoaded) {
    dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
    dotenv.config();
    isLoaded = true;
  }

  return {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? DEFAULT_REGION,
    stage: process.env.STAGE ?? DEFAULT_STAGE,
  };
}
