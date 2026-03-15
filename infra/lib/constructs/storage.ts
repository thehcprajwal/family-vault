import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { ALLOWED_ORIGINS, DEFAULT_STAGE } from '../config/app-config';

export interface StorageConstructProps {
  stage: string;
}

export class StorageConstruct extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageConstructProps) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `familyvault-documents-${props.stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy:
        props.stage === DEFAULT_STAGE ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: props.stage === DEFAULT_STAGE,
    });

    this.bucket.addCorsRule({
      allowedOrigins: ALLOWED_ORIGINS,
      allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
      allowedHeaders: ['*'],
      maxAge: 3000,
    });

    this.bucket.addLifecycleRule({
      id: 'IntelligentTieringAfter180Days',
      enabled: true,
      transitions: [
        {
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(180),
        },
      ],
    });

    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: this.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'DocumentsBucketArn', {
      value: this.bucket.bucketArn,
    });
  }
}
