import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { FamilyVaultStack } from '../lib/familyvault-stack';

describe('FamilyVaultStack', () => {
  beforeEach(() => {
    process.env.STAGE = 'dev';
  });

  test('creates secure storage and auth defaults', () => {
    const app = new cdk.App();
    const stack = new FamilyVaultStack(app, 'TestFamilyVaultStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'familyvault-documents-dev',
      BucketEncryption: {
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          }),
        ]),
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });

    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'familyvault-users-dev',
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: true,
      },
      Policies: {
        PasswordPolicy: Match.objectLike({
          MinimumLength: 8,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: false,
          RequireUppercase: false,
        }),
      },
    });
  });

  test('creates http api with jwt authorization', () => {
    const app = new cdk.App();
    const stack = new FamilyVaultStack(app, 'TestFamilyVaultStackApi');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      Name: 'familyvault-api-dev',
      ProtocolType: 'HTTP',
    });

    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      IdentitySource: ['$request.header.Authorization'],
      JwtConfiguration: Match.objectLike({
        Audience: Match.arrayWith([Match.anyValue()]),
      }),
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'familyvault-health-check-dev',
      Runtime: 'nodejs20.x',
      MemorySize: 128,
      Timeout: 10,
    });
  });
});
