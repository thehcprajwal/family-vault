import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface NotificationsConstructProps {
  stage: string;
  table?: dynamodb.Table;
}

export class NotificationsConstruct extends Construct {
  public readonly textractTopic: sns.Topic;
  public readonly textractRole: iam.Role;
  public readonly pushNotificationTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: NotificationsConstructProps) {
    super(scope, id);

    const { stage } = props;

    // ── Textract async completion topic ──────────────────────
    this.textractTopic = new sns.Topic(this, 'TextractTopic', {
      topicName: `familyvault-textract-${stage}`,
    });

    this.textractRole = new iam.Role(this, 'TextractRole', {
      assumedBy: new iam.ServicePrincipal('textract.amazonaws.com'),
      description: 'Allows Textract to publish async job completion to SNS',
    });

    this.textractTopic.grantPublish(this.textractRole);

    new cdk.CfnOutput(this, 'TextractTopicArn', {
      value: this.textractTopic.topicArn,
    });

    new cdk.CfnOutput(this, 'TextractRoleArn', {
      value: this.textractRole.roleArn,
      exportName: `FamilyVault-TextractRoleArn-${stage}`,
    });

    // ── Push notification topic ────────────────────────────────
    this.pushNotificationTopic = new sns.Topic(this, 'PushNotificationTopic', {
      topicName: `familyvault-push-notifications-${stage}`,
    });

    new cdk.CfnOutput(this, 'PushNotificationTopicArn', {
      value: this.pushNotificationTopic.topicArn,
    });

    // ── ExpiryReminder Lambda (EventBridge monthly) ───────────
    if (props.table) {
      const expiryReminderLambda = new lambdaNodejs.NodejsFunction(this, 'ExpiryReminderLambda', {
        functionName: `familyvault-expiry-reminder-${stage}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.resolve(__dirname, '../../../lambdas/expiry-reminder/index.ts'),
        handler: 'handler',
        bundling: { format: lambdaNodejs.OutputFormat.CJS, minify: true, sourceMap: true, target: 'node20', externalModules: [] },
        environment: {
          TABLE_NAME: props.table.tableName,
          PUSH_NOTIFICATION_SNS_TOPIC_ARN: this.pushNotificationTopic.topicArn,
        },
        timeout: cdk.Duration.seconds(60),
        memorySize: 256,
      });

      props.table.grantReadData(expiryReminderLambda);
      this.pushNotificationTopic.grantPublish(expiryReminderLambda);

      const monthlyRule = new events.Rule(this, 'ExpiryReminderMonthlyRule', {
        ruleName: `familyvault-expiry-reminder-monthly-${stage}`,
        schedule: events.Schedule.cron({ minute: '0', hour: '8', day: '1', month: '*' }),
        description: 'Triggers ExpiryReminder Lambda on 1st of each month at 8am UTC',
      });

      monthlyRule.addTarget(new eventsTargets.LambdaFunction(expiryReminderLambda));
    }

    // ── VAPID keys stored in SSM ───────────────────────────────
    // Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars before deploying.
    // Generate with: npx web-push generate-vapid-keys
    new ssm.StringParameter(this, 'VapidPublicKey', {
      parameterName: `/familyvault/${stage}/vapid-public-key`,
      stringValue: process.env.VAPID_PUBLIC_KEY ?? 'REPLACE_WITH_VAPID_PUBLIC_KEY',
      description: 'VAPID public key for web push notifications',
    });

    new ssm.StringParameter(this, 'VapidPrivateKey', {
      parameterName: `/familyvault/${stage}/vapid-private-key`,
      stringValue: process.env.VAPID_PRIVATE_KEY ?? 'REPLACE_WITH_VAPID_PRIVATE_KEY',
      description: 'VAPID private key for web push notifications',
    });
  }
}
