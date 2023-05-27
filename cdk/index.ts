import "source-map-support/register";
import "dotenv/config";

import path from "path";
import fs from "fs";

import * as cdk from "aws-cdk-lib";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as s3o from "aws-cdk-lib/aws-cloudfront-origins";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3d from "aws-cdk-lib/aws-s3-deployment";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as lambda from "aws-cdk-lib/aws-lambda";

import { config } from "./config";

const app = new cdk.App();
const stack = new cdk.Stack(app, "BlogStack", {
  env: { region: "us-east-1" },
});

const bucket = new s3.Bucket(stack, "Bucket", {
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
});

new cdk.CfnOutput(stack, "BucketName", { value: bucket.bucketName });

new s3d.BucketDeployment(stack, "BucketDeployment", {
  destinationBucket: bucket,
  sources: [s3d.Source.asset(path.join(process.cwd(), "public"))],
});

const certificate = acm.Certificate.fromCertificateArn(
  stack,
  "Certificate",
  ssm.StringParameter.valueForStringParameter(
    stack,
    `/infrastructure/acm/${config.domainName}/certificate_arn`
  )
);

const handlerContents = fs
  .readFileSync(path.join(process.cwd(), "cdk", "redirect.lambda.js"))
  .toString();

const handler = new cf.experimental.EdgeFunction(stack, "RedirectHandler", {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: "index.handler",
  code: lambda.Code.fromInline(handlerContents),
});

new cdk.CfnOutput(stack, "RedirectHandlerArn", {
  value: handler.functionArn,
});

const oai = new cf.OriginAccessIdentity(stack, "OriginAccessIdentity");
bucket.grantRead(oai);

const distribution = new cf.Distribution(stack, "Distribution", {
  certificate,
  domainNames: [config.domainName],
  defaultRootObject: "index.html",
  httpVersion: cf.HttpVersion.HTTP2_AND_3,
  minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
  sslSupportMethod: cf.SSLMethod.SNI,
  // enableLogging: true,
  defaultBehavior: {
    origin: new s3o.S3Origin(bucket, { originAccessIdentity: oai }),
    allowedMethods: cf.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    compress: true,
    cachePolicy: new cf.CachePolicy(stack, "DistributionCachePolicy", {
      queryStringBehavior: cf.CacheQueryStringBehavior.allowList("q"),
      headerBehavior: cf.CacheHeaderBehavior.none(),
      cookieBehavior: cf.CacheCookieBehavior.none(),
    }),
    edgeLambdas: [
      {
        eventType: cf.LambdaEdgeEventType.VIEWER_REQUEST,
        functionVersion: handler.currentVersion,
      },
    ],
  },
  errorResponses: [
    { httpStatus: 404, responseHttpStatus: 404, responsePagePath: "/404.html" },
    { httpStatus: 403, responseHttpStatus: 404, responsePagePath: "/404.html" },
  ],
});

new cdk.CfnOutput(stack, "DistributionID", {
  value: distribution.distributionId,
});

new ssm.StringParameter(stack, "DistributionIDParameter", {
  parameterName: `/infrastructure/cloudfront/${config.domainName}/distribution_id`,
  stringValue: distribution.distributionId,
});

const zone = r53.HostedZone.fromHostedZoneAttributes(stack, "HostedZone", {
  hostedZoneId: config.hostedZoneId,
  zoneName: config.hostedZoneName,
});

new r53.CnameRecord(stack, "CnameRecord", {
  zone,
  domainName: distribution.domainName,
  recordName: config.subdomainName,
});

cdk.Tags.of(app).add("GitRepository", "https://github.com/hans-m-song/blog");
cdk.Tags.of(app).add("Purpose", "Content");
cdk.Tags.of(app).add("StackName", cdk.Fn.ref("AWS::StackName"));
