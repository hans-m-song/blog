---
title: "Simple Serverless Site Boilerplate"
date: 2023-06-25T10:47:44+10:00
draft: false
toc: true
tags: [aws, cdk, serverless, walkthrough]
---

A fairly common pattern used to deploy a serverless website on AWS is CloudFront + API Gateway + Lambdas. In this post, I'll introduce my take as I realize that I have been using this pattern fairly regularly so I figured I would note it down here so I can copy-paste it for future use. The general approach is as follows:

- Static site contents deployed to an S3 bucket
- Backend deployed as lambdas, integrated with API Gateway
- Everything behind CloudFront for caching
- Tied together with AWS CDK

## Prerequisites

You will need:

- Node.js & NPM
- An AWS account with sufficient privileges
- Some content

## Scaffolding

The project root would look something along the lines of the following:

```
project-root
├── cdk.json      <- CDK metadata
├── handlers/     <- lambda entry points
├── infra/        <- CDK stack spec
├── lib/          <- for a JavaScript / TypeScript project
├── package.json  <- NPM config
├── pkg/          <- for a Go project
├── tsconfig.json <- TypeScript config
└── ui/           <- frontend
```

Setting up the project

```bash
# pick your version of Node
echo "18" > .nvmrc

# dependencies
npm install \
  aws-cdk \
  aws-cdk-lib \
  constructs \
  tsx \
  typescript

# development dependencies
npm install --save-dev \
  @types/node \
  dotenv \
  source-map-support
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2016",
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true
  },
  "include": ["infra"]
}
```

### `cdk.json`

Here I also set the bootstrap qualifier to "tookit", really this depends on how you bootstrapped your AWS account. You may add other context flags here as you see fit.

```json
{
  "app": "tsx infra/index.ts",
  "context": {
    "@aws-cdk/core:bootstrapQualifier": "toolkit"
  }
}
```

### `.eslintrc.yaml`

Optionally, you may choose to add prettier and eslint to your project

```bash
npm install --save-dev \
  @types/node \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint \
  eslint-config-prettier \
  eslint-config-import \
  eslint-plugin-jsx-a11y \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  prettier
```

```yaml
root: true

extends:
  - eslint:recommended
  - plugin:@typescript-eslint/recommended
  - plugin:react/recommended
  - plugin:react-hooks/recommended
  - plugin:jsx-a11y/recommended
  - plugin:prettier/recommended

env:
  node: true
  browser: true

plugins:
  - import
  - "@typescript-eslint"
  - react
  - prettier

parser: "@typescript-eslint/parser"
parserOptions:
  ecmaFeatures:
    jsx: true

settings:
  react:
    version: detect

rules:
  "@typescript-eslint/no-explicit-any":
    - warn

  "@typescript-eslint/no-unused-vars":
    - warn
    - vars: all
      args: after-used
      ignoreRestSiblings: false
      argsIgnorePattern: ^_

  import/order:
    - warn
    - groups:
        - - builtin
          - external
        - - parent
          - sibling
          - index
      newlines-between: always
      alphabetize:
        order: asc
        caseInsensitive: true
      pathGroups:
        - pattern: ~/**
          group: parent
          position: before

  no-unused-vars:
    - off

  prettier/prettier:
    - error
    - {}
    - usePrettierrc: true

  react/react-in-jsx-scope:
    - off
```

</details>

## Configuration

There are some variables you will need to figure out how to introduce into your infrastructure through CDK context, environment variables, SSM, etc. The following code will be referencing the following variables

- `stack` - the root stack construct
- `certificateArn` - An ACM certificate, needs to be in the `us-east-1` region to be compatible with CloudFront.
- `domainName` - The public facing domain name
- `hostedZoneId`, `hostedZoneName` - The Route53 hosted zone in which the DNS record will be created. If you manage your DNS elsewhere then this can be ignored
- `siteCompileCommand` - the command you would use to generate your site content
- `siteOutputDirectory` - the folder in which the site content is rendered into

Apart from `stack`, these variables can be introduced in many ways:

- via cdk contexts
  - set through a command line argument `--context domainName=example.com` or in `cdk.json`
    ```json
    {
      "app": "npx tsx infra/index.ts",
      "context": {
        "domainName": "example.com"
      }
    }
    ```
  - reference with built-in context resolution
    ```typescript
    const domainName = stack.tryGetContext("domainName");
    ```
- through an SSM parameter
  ```typescript
  import * as ssm from "aws-cdk-lib/aws-ssm";
  const domainName = ssm.StringParameter.valueForStringParameter(
    stack,
    "/path/to/domainName"
  );
  ```
- through environment variables
  ```typescript
  const domainName = process.env.DOMAIN_NAME;
  ```

### The static content

We will make use of the built-in `BucketDeployment` CDK construct which will copy our site contents into an S3 bucket and automatically invalidate the CloudFront distribution accordingly

```typescript
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3d from "aws-cdk-lib/aws-s3-deployment";
import { spawnSync } from "child_process";

const bucket = new s3.Bucket(stack, {
  // the bucket should only be accessible via cloudfront
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});

// for some reason - must explicitly grant cloudfront read permissions
const oai = new cf.OriginAccessIdentity(stack, "OriginAccessIdentity");
bucket.grantRead(oai);

const distribution = new cf.Distribution(stack, "Distribution", {
  certificate: acm.Certificate.fromCertificateArn(certificateArn),
  minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
  domainNames: [domainName],
  defaultRootObject: "/index.html",
  // if your site is an SPA - this is required
  errorResponses: [
    {
      httpStatus: 404,
      responseHttpStatus: 200,
      responsePagePath: "/index.html",
    },
  ],
  defaultBehavior: {
    origin: new cfo.S3Origin(bucket, { originAccessIdentity: oai }),
  },
});

// render the site
const [command, ...args] = siteCompileCommand.split(" ");
spawnSync(command, args, {
  cwd: process.cwd(),
  stdio: ["ignore", "inherit", "inherit"],
});

// assert content exists
fs.statSync(siteOutputDirectory);

// stage the content for deployment
new s3d.BucketDeployment(bucket, "BucketDeployment", {
  destinationBucket: bucket,
  sources: [s3d.Source.asset(siteOutputDirectory)],
  distribution: distribution,
  distributionPaths: ["/*"],
});
```

### The backend

The backend will consist of serverless lambdas, what language you use is up to you. I will be utilising the new HTTP API offered by API Gateway as it is much simpler but the original REST API will also work just as well.

If you haven't already, install the API Gateway CDK construct library and any other libraries that may not have been promoted to stable yet (in this example, I use the `GoFunction` construct).

```bash
npm install \
  @aws-cdk/aws-apigatewayv2-alpha \
  @aws-cdk/aws-apigatewayv2-integrations-alpha \
  @aws-cdk/aws-lambda-go-alpha
```

```typescript
import * as api2 from "@aws-cdk/aws-apigateway2-alpha";
import * as api2i from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as go from "@aws-cdk/aws-lambda-go-alpha";

const api = new api2.HttpApi(stack, "HttpApi");

// a helper function to register routes
const addRoute = (
  method: api2.HttpMethod,
  path: string,
  config: go.GoFunctionProps
) => {
  // generate a stable id based on the method and path
  const name = `${method.toUpperCase()} ${path}`;
  const id = name.replace(/[^a-zA-Z0-9]+/g, "-");
  // create the handler and integration
  const handler = new go.GoFunction(api, id, config);
  const integration = new api2i.HttpLambdaIntegration("Integration", handler);
  // register the integration
  api.addRoutes({ methods: [method], path, integration });
};

addRoute(api2.HttpMethod.GET, "/api/world", {
  entry: "handlers/hello_world/main.go",
});

addRoute(api2.HttpMethod.POST, "/api/world", {
  entry: "handlers/goodbye_world/main.go",
});
```

Once your API is configured, you may attach it as a behavior to your CloudFront distribution so that they share a common domain name, negating the hassle of setting up CORS.

**Note:** if you want to do this, the API route must be prefixed with the path pattern configured in the distribution behavior. For example, if you want your API to be available under `/api/*`, your handler must be registered under the route `/api/path/to/handler`

```typescript
import * as cfo from "aws-cdk-lib/aws-cloudfront-origins";

distribution.addBehaviour(
  "/api/*":
  new cfo.HttpOrigin(api.domainName, {connectionAttempts: 1}),
  {
    allowedMethods: cf.AllowedMethods.ALLOW_ALL,
    // note: this is required as API Gateway expects the host to match the domain
    originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    responseHeadersPolicy: cf.ResponseHeadersPolicy.SECURITY_HEADERS,
    // note: this is required as API Gateway does not work with HTTP
    viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  }
)
```

### DNS

Now that everything is together, you may want to alias your CloudFront distribution to a nicer custom domain name.

```typescript
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53t from "aws-cdk-lib/aws-route53-targets";

const hostedZone = r53.HostedZone.fromHostedZoneAttributes(
  stack,
  "HostedZone",
  { hostedZoneId, zoneName: hostedZoneName }
);

const target = new r53t.CloudFrontTarget(site.distribution);

new r53.ARecord(stack, "ARecord", {
  zone: hostedZone,
  recordName: `${domainName}.`,
  target: r53.RecordTarget.fromAlias(target),
});
```
