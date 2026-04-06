import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface NotificationsConstructProps {
  stage: string;
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
