import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import {
  COGNITO_CALLBACK_URLS,
  COGNITO_LOGOUT_URLS,
  DEFAULT_STAGE,
} from '../config/app-config';

export interface AuthConstructProps {
  stage: string;
}

export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly domain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `familyvault-users-${props.stage}`,
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy:
        props.stage === DEFAULT_STAGE ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });

    this.userPool.addCustomAttributes({
      vaultId: new cognito.StringAttribute({
        minLen: 36,
        maxLen: 36,
        mutable: false,
      }),
      role: new cognito.StringAttribute({
        minLen: 5,
        maxLen: 6,
        mutable: true,
      }),
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `familyvault-app-client-${props.stage}`,
      authFlows: {
        userSrp: true,
        userPassword: false,
        adminUserPassword: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: COGNITO_CALLBACK_URLS,
        logoutUrls: COGNITO_LOGOUT_URLS,
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(365),
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      generateSecret: false,
    });

    this.domain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: `familyvault-${props.stage}`,
      },
    });

    new cdk.CfnOutput(this, 'ConstructUserPoolId', {
      value: this.userPool.userPoolId,
    });
    new cdk.CfnOutput(this, 'ConstructUserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'ConstructCognitoDomainUrl', {
      value: this.domain.domainName,
    });
  }
}
