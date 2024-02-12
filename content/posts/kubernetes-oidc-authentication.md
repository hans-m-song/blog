---
title: "Kubernetes OIDC Authentication"
date: 2023-09-16T15:36:47+10:00
draft: false
tags: [auth0, kubernetes, oidc, terraform, walkthrough]
---

As I have started dabbling in SSO and federated identity management using Auth0, I had a thought: "could I access my Kubernetes cluster with an Auth0 user identity?". And so, begins a new (fairly short) rabbit-hole to dive into.

## Prerequisites

You will need:

- A free Auth0 account
- A computer
- A decision on your Kubernetes flavour of choice, I will be using [K3S](https://k3s.io/) here
- `kubectl` with [kubelogin](https://github.com/int128/kubelogin) installed

## Setup

1. Create a machine-to-machine Auth0 Client. Take note of your client ID and client secret.

   In Terraform, it would look something like this:

   ```terraform
   resource "auth0_client" "client" {
    name           = "Client"
    app_type       = "non_interactive"
    is_first_party = true
    sso            = false
    callbacks      = ["http://localhost:8000"] # required for kubelogin

    grant_types = [
      "client_credentials",
      "refresh_token",
      "authorization_code",
      "implicit",
    ]

    jwt_configuration {
      alg                 = "RS256"
      lifetime_in_seconds = 36000
    }
   }
   ```

1. Boot up your Kubernetes API server with OIDC server credentials using the following flags:

   - `oidc-issuer-url`
   - `oidc-client-id`
   - `oidc-username-claim`
   - `oidc-username-prefix`
   - `oidc-groups-prefix`

   Hint - when starting up a K3S master node:

   ```bash
   curl -sfL https://get.k3s.io | INSTALL_K3S_CHANNEL=stable sh -s - \
     --disable "traefik" \
     --disable "metrics-server" \
     --disable "local-storage" \
     --kube-apiserver-arg="oidc-issuer-url=https://axatol.au.auth0.com/" \
     --kube-apiserver-arg="oidc-client-id=${CLIENT_ID}" \
     --kube-apiserver-arg="oidc-username-claim=email" \
     --kube-apiserver-arg="oidc-username-prefix=oidc:" \
     --kube-apiserver-arg="oidc-groups-prefix=oidc:"
   ```

1. Create a role binding to grant users privileges (replace `${USER_EMAIL}`)

   ```yaml
   apiVersion: rbac.authorization.k8s.io/v1
   kind: ClusterRoleBinding
   metadata:
     name: ${USER_EMAIL}
   subjects:
     - kind: User
       name: oidc:${USER_EMAIL}
       apiGroup: rbac.authorization.k8s.io
   roleRef:
     kind: ClusterRole
     name: cluster-admin
     apiGroup: rbac.authorization.k8s.io
   ```

1. Configure your Kubernetes credentials

   ```bash
   kubectl oidc-login setup \
     --oidc-issuer-url="https://${AUTH0_ORGANIZATION}.au.auth0.com/" \
     --oidc-client-id="${CLIENT_ID}" \
     --oidc-client-secret="${CLIENT_SECRET}" \
     --oidc-extra-scope="email"
   ```

1. At this point, when you attempt a kubectl command, kubelogin should step in and prompt you to log into your Auth0 tenant. If you run into issues, make sure to check the server logs, e.g.

   ```bash
   systemctl status k3s.service
   # OR
   journalctl -xeu k3s.service
   ```

   Some errors I've encountered:

   > Unable to authenticate the request" err="[invalid bearer token, oidc: verify token: oidc: expected audience \"xxx\" got [\"yyy\"]]"

   - Ensure the audience given to the Kubernetes API server and configured in your kubeconfig matches the client ID in Auth0.

   > Unable to authenticate the request" err="[invalid bearer token, oidc: parse username claims \"xxx\": claim not present]"

   - Ensure the Auth0 client is allowed to provide the claim and add it to the Kubernetes user configuration with `--oidc-extra-scope="xxx"`
