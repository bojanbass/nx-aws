# NX AWS Cache Infrastructure as Code

The plugin does not enforce any specific infrastructure. It does require you to have certain elements (e.g. an S3 bucket, a user with access to it, etc.). You can create such infrastructure manually or you can use the provided IaC (Infrastructure as Code) to create it automatically.

In order to ease the process of creating the infrastructure, this package provides a CLI that will create the infrastructure for you. It contains the IaC for creating the infrastructure and you can run it by just calling a command. It uses AWS CDK (Cloud Development Kit) to create the infrastructure. The infrastructure is defined in the `lib/nx-aws-cache-iac-stack.ts` file.

The CLI will create a new Stack in your AWS account. The Stack will create a new S3 bucket and an IAM user with access to it. The credentials for the user will be stored in the AWS Secrets Manager.

## How to deploy the infrastructure

This command will deploy a new Stack that creates a S3 bucket for the cache and an IAM user with access to it.
This user will have the credentials stored in the AWS Secrets Manager.

```bash
# Login into AWS, then run
npx @nx-aws-plugin/nx-aws-cache-iac cdk deploy

# NOTE that you can also run `diff` and `destroy`
```

## How to retrieve secrets

To download the credentials for the IAM user, run the following command which will store the credentials in the `.env.local` file.

```bash
# Login into AWS, then run
npx @nx-aws-plugin/nx-aws-cache-iac config-to-env
```

## How to use the cache

Follow the instructions of the project. Note that the environment variables are already set in the `.env.local` file. After you source such file, you only have to set the runner in the `nx.json` file like this:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nx-aws-plugin/nx-aws-cache"
    }
  }
}
```
