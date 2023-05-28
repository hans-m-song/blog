---
title: "Resume"
date: 2023-05-28T00:00:10+10:00
draft: false
toc: true
showDate: false
norss: true
tags: []
---

## Skills

### Languages and libraries

- JavaScript, TypeScript - React.js, Redux, Material UI, Jest, Playwright / Puppeteer, Axios
- Go - Cobra, Viper, Zerolog, Chi
- Python - Pip, Pipenv

### Frameworks and tooling

- Development - Git, Bash
- Testing - Jest, Playwright / Puppeteer
- Project Management - GitHub, GitLab, Jira / Confluence
- Databases - PostgreSQL, DynamoDB, MongoDB
- CI / CD - Github Actions, Jenkins, Docker
- IAC - AWS CloudFormation, AWS CDK, Kubectl, Helm, Terraform
- Frontend - React.js, Redux, Material UI, Vue

### Platforms and services

- Hosted - AWS
- Services - JFrog Artifactory, Snyk, Sendgrid
- Bare metal - Kubernetes, Docker compose
- Observability - New Relic, Splunk

## Experience

### Flight Centre - DevOps Engineer

_Oct 2022 - Now_

- Supporting developers in implementing well-architected solutions with a focus on security
- Maintaining and deploying infrastructure shared across multiple business units
- Integrating SaaS products with existing infrastructure with a focus on developer experience

### Flight Centre - Full Stack Software Engineer

_Nov 2021 - Oct 2022_

- Building scalable, flexible solutions from the ground up
- Implementing effective application observability
- Integrating legacy services with next-generation technology for eventual replacement

### Credfin - Software Engineer

_Jan 2019 - Apr 2021_

- Working and sometimes leading in a team utilising agile development principles
- Migrating, maintaining, and extending customer facing products
- Architecting and implementing scalable microservices
- Enhancing and maintaining continuous integration/deployment strategies
- Building and enhancing data aggregation services
- Creating a dashboard to aid developer experience interacting with the backend

### Sortal - Intern

_Nov 2018 - Jan 2019_

- Implementing machine learning model integration into a microservice architecture

## Education

### Bachelor of Software Engineering (Honours)

_University of Queensland - Graduated 2021_

Favourite courses include:

- `CSSE2310` - Computer Systems Principles and Programming
- `DECO3800` - Design Computing Studio 3 - Proposal
- `DECO3801` - Design Computing Studio 3 - Build
- `COMP4403` - Compilers and Interpreters

## Stuff I'm working on

### [huisheng](https://github.com/hans-m-song/huisheng) - _Discord bot_

_TypeScript_

What was originally just an experimental learning project for writing a bot became a full-featured Discord bot used regularly by two Discord servers. Primary feature is playing audio from YouTube. Automatically builds and rollouts the new image on push.

### [iac](https://github.com/hans-m-song/iac) - _IAC monorepo_

_Terraform, TypeScript, AWS CDK, Helm_

One-stop-shop for all things IAC. Contains my definitions for AWS, GitHub, Auth0, and (soon to come), Kubernetes resources. Automatically deploys using GitHub Actions on push.

### [kube-stack](https://github.com/hans-m-song/kube-stack) - _Kubernetes resources_

Current place where resources deployed to my kubernetes cluster is stored defined using TypeScript and [CDK8S](https://cdk8s.io/). Soon to be moved into the IAC monorepo. Includes deployments for Minio, GitHub Actions Runner Controller, Media Centre (JellyFin + Lidarr, Sonarr, etc), New Relic, and more.
