# NX AWS Cache Infrastructure as Code

Sets the infrastructure for the AWS Cache for NX. This is a cache that is shared between all the projects in the monorepo.
It is meant to ease the infrastructure setup of [nx-aws](https://github.com/bojanbass/nx-aws).

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
