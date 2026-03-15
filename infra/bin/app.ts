import * as cdk from 'aws-cdk-lib';
import { loadInfraEnvironment } from '../lib/config/environment';
import { FamilyVaultStack } from '../lib/familyvault-stack';

const environment = loadInfraEnvironment();

const app = new cdk.App();

new FamilyVaultStack(app, 'FamilyVaultStack', {
  env: {
    account: environment.account,
    region: environment.region,
  },
  description: 'FamilyVault Sprint 1 infrastructure stack',
});
