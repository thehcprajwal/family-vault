import * as cdk from 'aws-cdk-lib';
import * as path from 'node:path';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

export interface PipelineConstructProps {
  stage: string;
  bucket: s3.Bucket;
}

export class PipelineConstruct extends Construct {
  public readonly deleteObjectTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: PipelineConstructProps) {
    super(scope, id);

    const { stage, bucket } = props;

    this.deleteObjectTopic = new sns.Topic(this, 'DeleteObjectTopic', {
      topicName: `familyvault-delete-object-${stage}`,
    });

    const s3DeleteObjectLambda = new lambdaNodejs.NodejsFunction(this, 'S3DeleteObjectLambda', {
      functionName: `familyvault-s3-delete-object-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../../lambdas/s3-delete-object/index.ts'),
      handler: 'handler',
      bundling: {
        format: lambdaNodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: [],
      },
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
    });

    bucket.grantDelete(s3DeleteObjectLambda);

    this.deleteObjectTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(s3DeleteObjectLambda),
    );
  }
}
