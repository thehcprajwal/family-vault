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
  pushNotificationTopic: sns.Topic;
  deleteObjectTopic: sns.Topic;
}

export class ApiConstruct extends Construct {
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly processDocumentLambda: lambdaNodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const { stage, table, bucket, textractTopic, textractRole, pushNotificationTopic, deleteObjectTopic } = props;

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
      PUSH_NOTIFICATION_SNS_TOPIC_ARN: pushNotificationTopic.topicArn,
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

    // ── ListPersons Lambda ────────────────────────────────────
    const listPersonsLambda = new lambdaNodejs.NodejsFunction(this, 'ListPersonsLambda', {
      functionName: `familyvault-list-persons-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/list-persons/index.ts'),
      handler: 'handler',
      bundling: {
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: [],
      },
      environment: { TABLE_NAME: table.tableName },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    table.grantReadData(listPersonsLambda);

    this.httpApi.addRoutes({
      path: '/v1/persons',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'ListPersonsIntegration',
        listPersonsLambda,
      ),
      authorizer,
    });

    // Grant process-document + textract-complete permission to publish push notifications
    pushNotificationTopic.grantPublish(this.processDocumentLambda);
    pushNotificationTopic.grantPublish(textractCompleteLambda);

    // ── PushNotification Lambda (SNS-triggered, no API route) ─
    const pushNotificationLambda = new lambdaNodejs.NodejsFunction(
      this,
      'PushNotificationLambda',
      {
        functionName: `familyvault-push-notification-${stage}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.resolve(__dirname, '../../../lambdas/push-notification/handler.ts'),
        handler: 'handler',
        bundling: {
          format: lambdaNodejs.OutputFormat.CJS,
          minify: true,
          sourceMap: true,
          target: 'node20',
          externalModules: [],
        },
        environment: {
          TABLE_NAME: table.tableName,
          VAPID_SSM_PATH: `/familyvault/${stage}`,
        },
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
      },
    );

    table.grantReadWriteData(pushNotificationLambda);

    pushNotificationLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameters'],
        resources: [
          `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter/familyvault/${stage}/*`,
        ],
      }),
    );

    pushNotificationTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(pushNotificationLambda),
    );

    // ── SavePushSubscription Lambda ───────────────────────────
    const savePushSubscriptionLambda = new lambdaNodejs.NodejsFunction(
      this,
      'SavePushSubscriptionLambda',
      {
        functionName: `familyvault-save-push-subscription-${stage}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.resolve(__dirname, '../../../lambdas/save-push-subscription/handler.ts'),
        handler: 'handler',
        bundling: {
          format: lambdaNodejs.OutputFormat.CJS,
          minify: true,
          sourceMap: true,
          target: 'node20',
          externalModules: [],
        },
        environment: {
          TABLE_NAME: table.tableName,
        },
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
      },
    );

    table.grantWriteData(savePushSubscriptionLambda);

    this.httpApi.addRoutes({
      path: '/v1/push/subscription',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'SavePushSubscriptionIntegration',
        savePushSubscriptionLambda,
      ),
      authorizer,
    });

    // ── ReclassifyDocument Lambda ─────────────────────────────
    const reclassifyDocumentLambda = new lambdaNodejs.NodejsFunction(
      this,
      'ReclassifyDocumentLambda',
      {
        functionName: `familyvault-reclassify-document-${stage}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.resolve(__dirname, '../../../lambdas/reclassify-document/handler.ts'),
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
        memorySize: 256,
      },
    );

    table.grantReadWriteData(reclassifyDocumentLambda);
    pushNotificationTopic.grantPublish(reclassifyDocumentLambda);

    this.httpApi.addRoutes({
      path: '/v1/documents/{id}/reclassify',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'ReclassifyDocumentIntegration',
        reclassifyDocumentLambda,
      ),
      authorizer,
    });

    // ── GetVaultMe Lambda ─────────────────────────────────────
    const getVaultMeLambda = new lambdaNodejs.NodejsFunction(this, 'GetVaultMeLambda', {
      functionName: `familyvault-get-vault-me-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/get-vault-me/index.ts'),
      handler: 'handler',
      bundling: {
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: [],
      },
      environment: { TABLE_NAME: table.tableName },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    table.grantReadData(getVaultMeLambda);

    this.httpApi.addRoutes({
      path: '/v1/vault/me',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'GetVaultMeIntegration',
        getVaultMeLambda,
      ),
      authorizer,
    });

    // ── UpdateVaultMe Lambda ──────────────────────────────────
    const updateVaultMeLambda = new lambdaNodejs.NodejsFunction(this, 'UpdateVaultMeLambda', {
      functionName: `familyvault-update-vault-me-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/update-vault-me/index.ts'),
      handler: 'handler',
      bundling: {
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: [],
      },
      environment: { TABLE_NAME: table.tableName },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    table.grantWriteData(updateVaultMeLambda);

    this.httpApi.addRoutes({
      path: '/v1/vault/me',
      methods: [apigatewayv2.HttpMethod.PATCH],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'UpdateVaultMeIntegration',
        updateVaultMeLambda,
      ),
      authorizer,
    });

    // ── Search Lambda ─────────────────────────────────────────
    const searchLambda = new lambdaNodejs.NodejsFunction(this, 'SearchLambda', {
      functionName: `familyvault-search-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/search/index.ts'),
      handler: 'handler',
      bundling: { format: lambdaNodejs.OutputFormat.CJS, minify: true, sourceMap: true, target: 'node20', externalModules: [] },
      environment: { ...commonEnv },
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
    });

    table.grantReadData(searchLambda);
    bucket.grantRead(searchLambda);

    this.httpApi.addRoutes({
      path: '/v1/search',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('SearchIntegration', searchLambda),
      authorizer,
    });

    // ── GetDocument Lambda ────────────────────────────────────
    const getDocumentLambda = new lambdaNodejs.NodejsFunction(this, 'GetDocumentLambda', {
      functionName: `familyvault-get-document-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/get-document/index.ts'),
      handler: 'handler',
      bundling: { format: lambdaNodejs.OutputFormat.CJS, minify: true, sourceMap: true, target: 'node20', externalModules: [] },
      environment: { TABLE_NAME: table.tableName, BUCKET_NAME: bucket.bucketName },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    table.grantReadData(getDocumentLambda);
    bucket.grantRead(getDocumentLambda);

    this.httpApi.addRoutes({
      path: '/v1/documents/{id}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('GetDocumentIntegration', getDocumentLambda),
      authorizer,
    });

    // ── GetDocumentVersions Lambda ────────────────────────────
    const getDocumentVersionsLambda = new lambdaNodejs.NodejsFunction(this, 'GetDocumentVersionsLambda', {
      functionName: `familyvault-get-document-versions-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/get-document-versions/index.ts'),
      handler: 'handler',
      bundling: { format: lambdaNodejs.OutputFormat.CJS, minify: true, sourceMap: true, target: 'node20', externalModules: [] },
      environment: { TABLE_NAME: table.tableName },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    table.grantReadData(getDocumentVersionsLambda);

    this.httpApi.addRoutes({
      path: '/v1/documents/{id}/versions',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('GetDocumentVersionsIntegration', getDocumentVersionsLambda),
      authorizer,
    });

    // ── UpdateDocument Lambda ─────────────────────────────────
    const updateDocumentLambda = new lambdaNodejs.NodejsFunction(this, 'UpdateDocumentLambda', {
      functionName: `familyvault-update-document-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/update-document/index.ts'),
      handler: 'handler',
      bundling: { format: lambdaNodejs.OutputFormat.CJS, minify: true, sourceMap: true, target: 'node20', externalModules: [] },
      environment: { TABLE_NAME: table.tableName },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    table.grantReadWriteData(updateDocumentLambda);

    this.httpApi.addRoutes({
      path: '/v1/documents/{id}',
      methods: [apigatewayv2.HttpMethod.PATCH],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('UpdateDocumentIntegration', updateDocumentLambda),
      authorizer,
    });

    // ── CreatePerson Lambda ───────────────────────────────────
    const createPersonLambda = new lambdaNodejs.NodejsFunction(this, 'CreatePersonLambda', {
      functionName: `familyvault-create-person-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/create-person/index.ts'),
      handler: 'handler',
      bundling: { format: lambdaNodejs.OutputFormat.CJS, minify: true, sourceMap: true, target: 'node20', externalModules: [] },
      environment: { TABLE_NAME: table.tableName, USER_POOL_ID: props.userPool.userPoolId },
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
    });

    table.grantReadWriteData(createPersonLambda);
    createPersonLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminAddUserToGroup'],
      resources: [props.userPool.userPoolArn],
    }));

    this.httpApi.addRoutes({
      path: '/v1/persons',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('CreatePersonIntegration', createPersonLambda),
      authorizer,
    });

    // ── UpdatePerson Lambda ───────────────────────────────────
    const updatePersonLambda = new lambdaNodejs.NodejsFunction(this, 'UpdatePersonLambda', {
      functionName: `familyvault-update-person-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/update-person/index.ts'),
      handler: 'handler',
      bundling: { format: lambdaNodejs.OutputFormat.CJS, minify: true, sourceMap: true, target: 'node20', externalModules: [] },
      environment: { TABLE_NAME: table.tableName },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    table.grantReadWriteData(updatePersonLambda);

    this.httpApi.addRoutes({
      path: '/v1/persons/{id}',
      methods: [apigatewayv2.HttpMethod.PATCH],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('UpdatePersonIntegration', updatePersonLambda),
      authorizer,
    });

    // ── DeletePerson Lambda ───────────────────────────────────
    const deletePersonLambda = new lambdaNodejs.NodejsFunction(this, 'DeletePersonLambda', {
      functionName: `familyvault-delete-person-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/delete-person/index.ts'),
      handler: 'handler',
      bundling: { format: lambdaNodejs.OutputFormat.CJS, minify: true, sourceMap: true, target: 'node20', externalModules: [] },
      environment: { TABLE_NAME: table.tableName },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    table.grantReadWriteData(deletePersonLambda);

    this.httpApi.addRoutes({
      path: '/v1/persons/{id}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('DeletePersonIntegration', deletePersonLambda),
      authorizer,
    });

    // ── CreateCategory Lambda ─────────────────────────────────
    const createCategoryLambda = new lambdaNodejs.NodejsFunction(this, 'CreateCategoryLambda', {
      functionName: `familyvault-create-category-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/create-category/index.ts'),
      handler: 'handler',
      bundling: { format: lambdaNodejs.OutputFormat.CJS, minify: true, sourceMap: true, target: 'node20', externalModules: [] },
      environment: { TABLE_NAME: table.tableName },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    table.grantWriteData(createCategoryLambda);

    this.httpApi.addRoutes({
      path: '/v1/categories',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('CreateCategoryIntegration', createCategoryLambda),
      authorizer,
    });

    // ── UpdateCategory Lambda ─────────────────────────────────
    const updateCategoryLambda = new lambdaNodejs.NodejsFunction(this, 'UpdateCategoryLambda', {
      functionName: `familyvault-update-category-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/update-category/index.ts'),
      handler: 'handler',
      bundling: { format: lambdaNodejs.OutputFormat.CJS, minify: true, sourceMap: true, target: 'node20', externalModules: [] },
      environment: { TABLE_NAME: table.tableName },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    table.grantReadWriteData(updateCategoryLambda);

    this.httpApi.addRoutes({
      path: '/v1/categories/{id}',
      methods: [apigatewayv2.HttpMethod.PATCH],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('UpdateCategoryIntegration', updateCategoryLambda),
      authorizer,
    });

    // ── ListDocuments Lambda ──────────────────────────────────
    const listDocumentsLambda = new lambdaNodejs.NodejsFunction(this, 'ListDocumentsLambda', {
      functionName: `familyvault-list-documents-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/list-documents/index.ts'),
      handler: 'handler',
      bundling: {
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: [],
      },
      environment: { TABLE_NAME: table.tableName },
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
    });

    table.grantReadData(listDocumentsLambda);

    this.httpApi.addRoutes({
      path: '/v1/documents',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'ListDocumentsIntegration',
        listDocumentsLambda,
      ),
      authorizer,
    });

    // ── GetDocumentStatus Lambda ──────────────────────────────
    const getDocumentStatusLambda = new lambdaNodejs.NodejsFunction(
      this,
      'GetDocumentStatusLambda',
      {
        functionName: `familyvault-get-document-status-${stage}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.resolve(__dirname, '../../../lambdas/get-document-status/index.ts'),
        handler: 'handler',
        bundling: {
          format: lambdaNodejs.OutputFormat.CJS,
          minify: true,
          sourceMap: true,
          target: 'node20',
          externalModules: [],
        },
        environment: { TABLE_NAME: table.tableName },
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
      },
    );

    table.grantReadData(getDocumentStatusLambda);

    this.httpApi.addRoutes({
      path: '/v1/documents/{id}/status',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'GetDocumentStatusIntegration',
        getDocumentStatusLambda,
      ),
      authorizer,
    });

    // ── DeleteDocument Lambda ─────────────────────────────────
    const deleteDocumentLambda = new lambdaNodejs.NodejsFunction(this, 'DeleteDocumentLambda', {
      functionName: `familyvault-delete-document-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/delete-document/index.ts'),
      handler: 'handler',
      bundling: {
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: [],
      },
      environment: {
        ...commonEnv,
        DELETE_OBJECT_TOPIC_ARN: deleteObjectTopic.topicArn,
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    table.grantReadWriteData(deleteDocumentLambda);
    deleteObjectTopic.grantPublish(deleteDocumentLambda);

    this.httpApi.addRoutes({
      path: '/v1/documents/{id}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'DeleteDocumentIntegration',
        deleteDocumentLambda,
      ),
      authorizer,
    });

    // ── GetExpiry Lambda ──────────────────────────────────────
    const getExpiryLambda = new lambdaNodejs.NodejsFunction(this, 'GetExpiryLambda', {
      functionName: `familyvault-get-expiry-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/get-expiry/index.ts'),
      handler: 'handler',
      bundling: { format: lambdaNodejs.OutputFormat.CJS, minify: true, sourceMap: true, target: 'node20', externalModules: [] },
      environment: { TABLE_NAME: table.tableName, BUCKET_NAME: bucket.bucketName },
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
    });

    table.grantReadData(getExpiryLambda);
    bucket.grantRead(getExpiryLambda);

    this.httpApi.addRoutes({
      path: '/v1/expiry',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('GetExpiryIntegration', getExpiryLambda),
      authorizer,
    });

    // ── GetVapidKey Lambda (no auth — public key) ─────────────
    const getVapidKeyLambda = new lambdaNodejs.NodejsFunction(this, 'GetVapidKeyLambda', {
      functionName: `familyvault-get-vapid-key-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/get-vapid-key/index.ts'),
      handler: 'handler',
      bundling: { format: lambdaNodejs.OutputFormat.CJS, minify: true, sourceMap: true, target: 'node20', externalModules: [] },
      environment: { VAPID_SSM_PATH: `/familyvault/${stage}` },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    getVapidKeyLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter/familyvault/${stage}/vapid-public-key`,
      ],
    }));

    this.httpApi.addRoutes({
      path: '/v1/push/vapid-key',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('GetVapidKeyIntegration', getVapidKeyLambda),
    });

    new cdk.CfnOutput(this, 'ConstructApiUrl', {
      value: this.httpApi.url ?? '',
    });
  }
}
