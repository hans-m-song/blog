---
title: "Adopting Helm Resources"
date: 2023-11-21T17:30:45+10:00
draft: false
tags: [cdk8s, kubernetes, helm, migration]
---

Recently, I undertook a big migration from [CDK8S](https://cdk8s.io/) to Helm.
While CDK8S provided the ability to generate Kubernetes manifests in an
imperative way using my language of choice, I noticed it can encourage bad
habits. In making it easy to abstract and my apps became littered with custom
logic and conditionals. This goes against the principles of IAC in which your
infrastructure should be declarative.

During the migration, I whipped up the following script which adds annotations
and labels to an existing app which allows me to use `kubectl diff` to
cross-check my migration.

```bash
release_name=my-release
app_name=my-original-app-name
namespace=some-namespace

# list all resources owned by the old release
resources=($(
  kubectl get all,serviceaccount,ingress,secret,configmap \
    --all-namespaces \
    --output json |
    jq \
      --raw-output \
      --compact-output \
      --arg app_name "$app_name" \
      --arg namespace "$namespace" \
      '
      .items
      | map(
        select(.metadata.name | startswith($app_name))
        | select(.metadata.namespace == $namespace)
        | select(.kind != "ReplicaSet")
        | select(.kind != "Pod")
        | { kind: .kind, name: .metadata.name }[]
      )
      '
))

# apply labels and annotations
for resource in ${resources[@]}; do
    name=$(echo $resource | jq --raw-output '.name')
    kind=$(echo $resource | jq --raw-output '.kind')
    echo "adopting resource: $namespace/$kind/$name"
    kubectl annotate $kind $name --namespace $namespace meta.helm.sh/release-namespace=$namespace
    kubectl annotate $kind $name --namespace $namespace meta.helm.sh/release-name=$release_name
    kubectl label $kind $name --namespace $namespace app.kubernetes.io/managed-by=Helm
done
```

I also entertained the idea of manually generating a synthetic Helm release
which one can use the handy [helm-diff](https://github.com/databus23/helm-diff) plugin.
I didn't end up using this as I figured it was much more useful to compare
against the live infrastructure.

```bash
cat $template_file \
  | base64 \
  | kubectl create secret generic sh.helm.release.v1.$release_name.v1 \
  --namespace $namespace \
  --from-file=release=/dev/stdin
helm diff upgrade ...
```
