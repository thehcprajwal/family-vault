import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DEFAULT_STAGE } from './config/app-config';
import { ApiConstruct } from './constructs/api';
import { AuthConstruct } from './constructs/auth';
import { DatabaseConstruct } from './constructs/database';
import { NotificationsConstruct } from './constructs/notifications';
import { PipelineConstruct } from './constructs/pipeline';
import { StorageConstruct } from './constructs/storage';

export class FamilyVaultStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = process.env.STAGE ?? DEFAULT_STAGE;

    const storage = new StorageConstruct(this, 'Storage', { stage });
    const auth = new AuthConstruct(this, 'Auth', { stage });
    const database = new DatabaseConstruct(this, 'Database', { stage });
    const notifications = new NotificationsConstruct(this, 'Notifications', { stage, table: database.table });
    const pipeline = new PipelineConstruct(this, 'Pipeline', { stage, bucket: storage.bucket });

    const api = new ApiConstruct(this, 'Api', {
      stage,
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
      table: database.table,
      bucket: storage.bucket,
      textractTopic: notifications.textractTopic,
      textractRole: notifications.textractRole,
      pushNotificationTopic: notifications.pushNotificationTopic,
      deleteObjectTopic: pipeline.deleteObjectTopic,
    });

    // Wire S3 PutObject event → ProcessDocument Lambda
    storage.addProcessDocumentTrigger(api.processDocumentLambda);

    new cdk.CfnOutput(this, 'BucketName', { value: storage.bucket.bucketName });
    new cdk.CfnOutput(this, 'UserPoolId', { value: auth.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: auth.userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'CognitoDomain', { value: auth.domain.domainName });
    new cdk.CfnOutput(this, 'TableName', { value: database.table.tableName });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.httpApi.url ?? '' });
  }
}
