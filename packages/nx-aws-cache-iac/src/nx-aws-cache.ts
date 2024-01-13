import { App, StackProps, Stack, RemovalPolicy, Duration, SecretValue } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { User, PolicyStatement, Effect, CfnAccessKey } from 'aws-cdk-lib/aws-iam';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export class AppStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create a new S3 bucket
    const bucket = new Bucket(this, 'nx-aws-cache-bucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          // eslint-disable-next-line no-magic-numbers
          expiration: Duration.days(30),
        },
      ],
    });

    // Create a new IAM user
    const user = new User(this, 'nx-aws-cache-user');

    // Grant the IAM user the necessary permissions to access the S3 bucket
    user.addToPolicy(
      new PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        effect: Effect.ALLOW,
        resources: [`${bucket.bucketArn}/*`],
      }),
    );

    user.addToPolicy(
      new PolicyStatement({
        actions: ['s3:ListBucket'],
        effect: Effect.ALLOW,
        resources: [bucket.bucketArn],
      }),
    );

    // Create Access Key
    const accessKey = new CfnAccessKey(this, 'NxAWSCacheAccessKey', {
      userName: user.userName,
    });

    // Store secrets
    const secret = new Secret(this, 'NxAWSCacheConfiguration', {
      secretName: '/nx-aws-cache/configuration',
      removalPolicy: RemovalPolicy.DESTROY,
      description: 'The JSON stringified Nx AWS Cache configuration',
      secretStringValue: SecretValue.unsafePlainText(
        JSON.stringify({
          NXCACHE_AWS_ACCESS_KEY_ID: accessKey.ref,
          NXCACHE_AWS_SECRET_ACCESS_KEY: accessKey.attrSecretAccessKey,
          NXCACHE_AWS_BUCKET: bucket.bucketName,
          NXCACHE_AWS_REGION: Stack.of(this).region,
        }),
      ),
    });

    // Store as a parameter
    new StringParameter(this, 'NxAWSCacheConfigurationParameter', {
      parameterName: '/nx-aws-cache/configuration',
      description: `ARN of the Nx AWS Cache configuration secret`,
      stringValue: secret.secretArn,
    });
  }
}
