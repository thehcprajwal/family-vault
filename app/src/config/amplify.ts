import { Amplify } from 'aws-amplify';
import awsConfig from '@/aws-exports';

let isConfigured = false;

export function configureAmplify(): void {
  if (isConfigured) {
    return;
  }

  Amplify.configure(awsConfig);
  isConfigured = true;
}
