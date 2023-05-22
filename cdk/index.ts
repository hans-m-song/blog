import "source-map-support/register";
import "dotenv/config";

import { App, Stack } from "aws-cdk-lib";
import { Distribution } from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { CnameRecord, HostedZone } from "aws-cdk-lib/aws-route53";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import path from "path";
import { assertEnv } from "./utils";

const SUBDOMAIN_NAME = assertEnv("SUBDOMAIN_NAME");
const HOSTED_ZONE_ID = assertEnv("HOSTED_ZONE_ID");
const HOSTED_ZONE_NAME = assertEnv("HOSTED_ZONE_NAME");

const app = new App();
const stack = new Stack(app, "Stack", { stackName: "BlogStack" });
const bucket = new Bucket(stack, "Bucket");

const zone = HostedZone.fromHostedZoneAttributes(stack, "HostedZone", {
  hostedZoneId: HOSTED_ZONE_ID,
  zoneName: HOSTED_ZONE_NAME,
});

new BucketDeployment(stack, "BucketDeployment", {
  destinationBucket: bucket,
  sources: [Source.asset(path.resolve(process.cwd(), "public"))],
});

const distribution = new Distribution(stack, "Distribution", {
  defaultRootObject: "index.html",
  defaultBehavior: { origin: new S3Origin(bucket) },
});

new CnameRecord(stack, "CnameRecord", {
  zone,
  domainName: distribution.domainName,
  recordName: SUBDOMAIN_NAME,
});
