import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';

export interface PwaConstructProps {
  distribution: cloudfront.Distribution;
}

export class PwaConstruct extends Construct {
  constructor(scope: Construct, id: string, props: PwaConstructProps) {
    super(scope, id);

    // No-cache policy for service worker and HTML entry points
    const noCachePolicy = new cloudfront.CachePolicy(this, 'NoCachePolicy', {
      cachePolicyName: `familyvault-no-cache-${cdk.Stack.of(this).stackName}`,
      defaultTtl: cdk.Duration.seconds(0),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(0),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Long-cache policy for hashed static assets
    const longCachePolicy = new cloudfront.CachePolicy(this, 'LongCachePolicy', {
      cachePolicyName: `familyvault-long-cache-${cdk.Stack.of(this).stackName}`,
      defaultTtl: cdk.Duration.seconds(31536000),
      minTtl: cdk.Duration.seconds(31536000),
      maxTtl: cdk.Duration.seconds(31536000),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Apply no-cache to sw.js and workbox runtime files via distribution behaviour additions
    // These are added as outputs so the stack can reference them in CfnDistribution overrides if needed
    new cdk.CfnOutput(this, 'NoCachePolicyId', { value: noCachePolicy.cachePolicyId });
    new cdk.CfnOutput(this, 'LongCachePolicyId', { value: longCachePolicy.cachePolicyId });
  }
}
