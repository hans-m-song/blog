---
title: "Setting Up a Hugo Blog"
date: 2023-05-28T10:00:00+10:00
draft: false
toc: true
tags: [walkthrough, hugo, aws, github-actions, cdk]
---

I'll be walking through how I set up this blog here, fairly straightforward although there were some issues with the hosting. It appears Hugo has some custom logic to make URLs pretty that does not work well with S3.

## Prerequisites

You will need:

- git
- Hugo CLI - see the [installation docs](https://gohugo.io/installation/) or just download [here](https://github.com/gohugoio/hugo/releases)
- Optional - an AWS account if you want to follow through the deploy steps

## Scaffolding

First up is the repository in GitHub. Manually create the repo or via IAC (read more [here](/posts/multi-environment-iac/)). I'll be referring to the repository containing [the source of this blog](https://github.com/hans-m-song/blog).

```bash
$ git clone https://github.com/hans-m-song/blog

Cloning into ...

...

$ cd blog

$ hugo new site .

Congratulations! Your new Hugo site is created in ...

...
```

At this point you should have a skeleton repository. You can then pick a theme from the [Hugo website](https://themes.gohugo.io/). I use [Ficturina](https://gitlab.com/gabmus/hugo-ficurinia) by [Gabriele Musco](https://gabmus.org/).

```bash
$ git submodule add https://gitlab.com/gabmus/hugo-ficurinia.git themes/ficurinia

Cloning into ...

...
```

## Configuration

Hugo creates a `config.toml` file by default but I prefer to use YAML, hence, I converted the contents

```yaml
baseURL: https://hsong.me/
languageCode: en-us
defaultContentLanguage: en
title: Hans Song
uglyURLs: false

theme: ficurinia
author: Hans Song
copyright: Hans Song - [GitHub](https://github.com/hans-m-song) - [LinkedIn](https://www.linkedin.com/in/hans-song/)
```

Then, add your theme specific configuration, For Ficturina, documentation is available in the [README](https://gitlab.com/gabmus/hugo-ficurinia#configuration). See my configuration [here](https://github.com/hans-m-song/blog/blob/master/config.yaml).

```yaml
params:
  description: Hans's blog
  author: Hans Song
  ...
menu:
  icons:
    ...
```

## Adding content

Before adding content, you can customise how new files are templated by modifying `./archetypes/default.md`

```yaml
---
title: "{{ replace .Name "-" " " | title }}"
date: {{ .Date }}
draft: true
toc: true
tags: []
---
```

Now you're ready to add pages/posts, start by generating a new page, Hugo will fill in the defaults set by your template.

```bash
$ hugo new content/posts/setting-up-a-hugo-blog.md
```

You can run the Hugo server locally to view your content before deploying

```bash
$ hugo serve

Start building sites ...

...

Web Server is available at http://localhost:1313/
```

## Deploying

There are many ways to deploy a static content such as this Hugo site, I chose to use CDK as I was familiar with AWS and have existing infrastructure in place. We will use [`tsx`](https://github.com/esbuild-kit/tsx) - a nifty tool that handles all of the complexity of typescript transpilation with esbuild.

### Infrastructure

First, set up a simple NPM project and install the CDK dependencies.

```bash
$ cat <<EOF > cdk.json
  {
    "app": "npx tsx ./cdk/index.ts",
    "context": {
      "@aws-cdk/core:bootstrapQualifier": "toolkit"
    }
  }
  EOF

$ cat <<EOF > tsconfig.json
  {
    "compilerOptions": {
      "lib": ["ESNext"],
      "module": "CommonJS",
      "target": "ESNext",
      "strict": true,
      "esModuleInterop": true,
      "isolatedModules": true
    },
    "include": ["cdk"]
  }
  EOF

$ cat <<EOF > package.json
  {
    "name": "blog",
    "scripts": {
      "deploy": "cdk deploy",
      "deploy:ci": "npm run deploy -- --ci",
      "diff": "cdk diff",
      "diff:ci": "npm run diff -- --ci"
    },
  }
  EOF

$ npm install aws-cdk aws-cdk-lib tsx

$ mkdir cdk
```

Specify your infrastructure with `./cdk/index.ts`, see [here](https://github.com/hans-m-song/blog/blob/master/cdk/index.ts) for how I did it. The jist is as follows:

1. Bucket is created disallowing all public access.
1. Site assets are uploaded into a bucket using a `BucketDeployment`.
1. An `OriginAccessIdentity` is created and granted read only access to the aforementioned S3 bucket.
1. CloudFront distribution is created, with default behaviour pointing to the aforementioned S3 bucket using the `OriginAccessIdentity`. Additionally, an edge lambda is created to handle the redirects that would normally be handled by the Hugo server, inspired by [this implementation](https://github.com/keaeriksson/hugo-s3-cloudfront/blob/master/template.yaml).
1. A CNAME is created to point to the distribution.
1. An ACM certificate is created and associated with the distribution (see [here](https://github.com/hans-m-song/iac/blob/cdde62a9a48dd78e0878253162f5ea1471905922/aws/stacks/index.ts#L22-L25)).

### CI/CD

The site makes use of GitHub actions, running in a self-hosted runner which can authenticate with my AWS account using `AssumeRoleWithWebIdentity` and [GitHub's OIDC provider](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services). See [here](https://github.com/hans-m-song/blog/blob/master/.github/workflows/deploy.yaml) for the final workflow.

General flow is as follows:

1. Checkout the repo

   ```yaml
   - uses: actions/checkout@v3
   ```

1. Install Hugo and build the site - here I use a [reusable action](https://github.com/axatol/actions/blob/master/setup-hugo)

   ```yaml
   - uses: axatol/actions/setup-hugo@release
   - run: hugo --gc --minify
   ```

1. Install the NPM dependencies and deploy the stack

   ```yaml
   - uses: actions/setup-node@v3
   - run: npm install
   - run: npm run deploy:ci
   ```

1. Optionally, invalidate the cloudfront distribution to ensure the new content is served

   ```yaml
   - id: invalidate
     run: |
       echo "invalidation_id=$(
         aws cloudfront create-invalidation \
           --distribution-id $your_distribution_id \
           --query 'Invalidation.Id' \
           --output text \
           --paths ...
       )" >> $GITHUB_OUTPUT
   - run: |
       aws cloudfront wait invalidation-completed \
         --distribution-id $your_distribution_id \
         --id ${{ steps.invalidate.outputs.invalidation_id }}
   ```

Once the workflow has completed, the site should be available at your configured domain.
