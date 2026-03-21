import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface NotificationsConstructProps {
  stage: string;
}

export class NotificationsConstruct extends Construct {
  public readonly textractTopic: sns.Topic;
  public readonly textractRole: iam.Role;

  constructor(scope: Construct, id: string, props: NotificationsConstructProps) {
    super(scope, id);

    this.textractTopic = new sns.Topic(this, 'TextractTopic', {
      topicName: `familyvault-textract-${props.stage}`,
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
      exportName: `FamilyVault-TextractRoleArn-${props.stage}`,
    });
  }
}
