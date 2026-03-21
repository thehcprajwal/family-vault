import * as cdk from 'aws-cdk-lib';
import * as path from 'node:path';
import { Construct } from 'constructs';
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apigatewayv2Authorizers from '@aws-cdk/aws-apigatewayv2-authorizers-alpha';
import * as apigatewayv2Integrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { ALLOWED_ORIGINS } from '../config/app-config';

export interface ApiConstructProps {
  stage: string;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  table: dynamodb.Table;
  bucket: s3.Bucket;
  textractTopic: sns.Topic;
  textractRole: iam.Role;
}

export class ApiConstruct extends Construct {
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly processDocumentLambda: lambdaNodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const { stage, table, bucket, textractTopic, textractRole } = props;

    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `familyvault-api-${stage}`,
      corsPreflight: {
        allowOrigins: ALLOWED_ORIGINS,
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
        allowCredentials: false,
        maxAge: cdk.Duration.days(1),
      },
    });

    const authorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.ap-south-1.amazonaws.com/${props.userPool.userPoolId}`,
      {
        identitySource: ['$request.header.Authorization'],
        jwtAudience: [props.userPoolClient.userPoolClientId],
      },
    );

    const commonEnv = {
      STAGE: stage,
      TABLE_NAME: table.tableName,
      BUCKET_NAME: bucket.bucketName,
      TEXTRACT_SNS_TOPIC_ARN: textractTopic.topicArn,
      TEXTRACT_ROLE_ARN: textractRole.roleArn,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
    };

    // ── Health check (Sprint 1) ───────────────────────────────
    const healthCheckLambda = new lambdaNodejs.NodejsFunction(this, 'HealthCheckLambda', {
      functionName: `familyvault-health-check-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/health-check/index.ts'),
      handler: 'handler',
      bundling: {
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        target: 'node20',
      },
      environment: {
        STAGE: stage,
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    this.httpApi.addRoutes({
      path: '/v1/health',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'HealthCheckIntegration',
        healthCheckLambda,
      ),
      authorizer,
    });

    // ── UploadUrl Lambda ──────────────────────────────────────
    const uploadUrlLambda = new lambdaNodejs.NodejsFunction(this, 'UploadUrlLambda', {
      functionName: `familyvault-upload-url-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/upload-url/index.ts'),
      handler: 'handler',
      bundling: {
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: [],
      },
      environment: commonEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    bucket.grantPut(uploadUrlLambda);

    this.httpApi.addRoutes({
      path: '/v1/upload-url',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'UploadUrlIntegration',
        uploadUrlLambda,
      ),
      authorizer,
    });

    // ── CreateDocument Lambda ─────────────────────────────────
    const createDocumentLambda = new lambdaNodejs.NodejsFunction(this, 'CreateDocumentLambda', {
      functionName: `familyvault-create-document-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/create-document/index.ts'),
      handler: 'handler',
      bundling: {
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: [],
      },
      environment: commonEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    table.grantReadWriteData(createDocumentLambda);

    this.httpApi.addRoutes({
      path: '/v1/documents',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'CreateDocumentIntegration',
        createDocumentLambda,
      ),
      authorizer,
    });

    // ── ProcessDocument Lambda (S3 event, no API route) ───────
    this.processDocumentLambda = new lambdaNodejs.NodejsFunction(this, 'ProcessDocumentLambda', {
      functionName: `familyvault-process-document-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/process-document/index.ts'),
      handler: 'handler',
      bundling: {
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: [],
      },
      environment: commonEnv,
      timeout: cdk.Duration.seconds(120), // Textract sync can take up to 60s
      memorySize: 512,
    });

    table.grantReadWriteData(this.processDocumentLambda);
    bucket.grantRead(this.processDocumentLambda);

    this.processDocumentLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['textract:DetectDocumentText', 'textract:StartDocumentTextDetection'],
        resources: ['*'],
      }),
    );

    // ── TextractComplete Lambda (SNS triggered) ───────────────
    const textractCompleteLambda = new lambdaNodejs.NodejsFunction(
      this,
      'TextractCompleteLambda',
      {
        functionName: `familyvault-textract-complete-${stage}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.resolve(__dirname, '../../../lambdas/textract-complete/index.ts'),
        handler: 'handler',
        bundling: {
          format: lambdaNodejs.OutputFormat.CJS,
          minify: true,
          sourceMap: true,
          target: 'node20',
          externalModules: [],
        },
        environment: commonEnv,
        timeout: cdk.Duration.seconds(60),
        memorySize: 512,
      },
    );

    table.grantReadWriteData(textractCompleteLambda);

    textractCompleteLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['textract:GetDocumentTextDetection'],
        resources: ['*'],
      }),
    );

    textractTopic.addSubscription(new snsSubscriptions.LambdaSubscription(textractCompleteLambda));

    // ── ConfirmDocument Lambda ────────────────────────────────
    const confirmDocumentLambda = new lambdaNodejs.NodejsFunction(this, 'ConfirmDocumentLambda', {
      functionName: `familyvault-confirm-document-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/confirm-document/index.ts'),
      handler: 'handler',
      bundling: {
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: [],
      },
      environment: commonEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    table.grantReadWriteData(confirmDocumentLambda);

    this.httpApi.addRoutes({
      path: '/v1/documents/{documentId}/confirm',
      methods: [apigatewayv2.HttpMethod.PATCH],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'ConfirmDocumentIntegration',
        confirmDocumentLambda,
      ),
      authorizer,
    });

    new cdk.CfnOutput(this, 'ConstructApiUrl', {
      value: this.httpApi.url ?? '',
    });
  }
}
