# Digital Citizenship APIs

[![CircleCI](https://circleci.com/gh/teamdigitale/digital-citizenship-functions/tree/master.svg?style=svg)](https://circleci.com/gh/teamdigitale/digital-citizenship-functions/tree/master)

This is the implementation of the Digital Citizenship APIs, based on the Azure Functions framework.

For further details about the Digital Citizenship initiative, checkout the [main Digital Citizenship](https://github.com/teamdigitale/cittadinanza-digitale) repository.

## Deploy resources to Azure

To run and develop functions locally you have to [create an Azure account](https://azure.microsoft.com/en-us/free/)
as Functions need Azure resources to run:

- [Storage account](https://docs.microsoft.com/it-it/azure/storage/common/storage-introduction)
- [Storage queues](https://azure.microsoft.com/en-us/services/storage/queues/)
- [CosmosDB database](https://docs.microsoft.com/en-us/azure/cosmos-db/introduction)
- [App service plan](https://docs.microsoft.com/en-us/azure/app-service/azure-web-sites-web-hosting-plans-in-depth-overview)

Steps are:

1. [Create an Azure account](https://azure.microsoft.com/en-us/free/)

2. Download and install the [Azure command line interface](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)

3. Clone the repository and install NodeJS packages:

git clone https://github.com/teamdigitale/digital-citizenship-functions
cd digital-citizenship-functions
npm install

4. Create a [SendGrid account](https://app.sendgrid.com/signup) and [get the API-KEY](https://sendgrid.com/docs/Classroom/Send/How_Emails_Are_Sent/api_keys.html)

5. Edit settings and provide the SendGrid API-KEY:

cd scripts
cp example.config.js local.config.js
vim local.config.js

*Skip the GitHub integration settings for now*.

6. Deploy needed resources to the Azure cloud:

az login
node script/resources.js --deploy-all

At this point you have all the needed resources in places but the Functions container
is empty (there are no functions to run) as no code was deployed remotely.

## Deploy functions to Azure

There a few options to deploy the Functions to Azure.

### Using GitHub

If you have a GitHub account you can set up a [continuos deployment flow](https://docs.microsoft.com/en-us/azure/azure-functions/functions-continuous-deployment).

1. Fork the GitHub repository into your account.

2. Edit scripts/local.config.js and write up your GitHub settings:

  gitRepoUrl: 'https://github.com/<your account>/digital-citizenship-functions',
  giRepoBranch: 'master',
  gitRepoToken: '087 .... e3788',

Where gitRepoToken is a [GitHub token with 'repo' grants](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/).

3. Deploy the new settings to the Functions container:

node scripts/resources.js --deploy-git

Once the settings are deployed, the Functions container will fetch the code from
your GitHub repository and deploy the functions automatically.

Every time you'll push into your master branch the function container
will fetch the new code and make a new deploy in the Azure cloud.

### Using Azure functions git repository

Instead of setting up and using a GitHub account, you can directly push your code
to the Azure source control manager which is linked to the function container:

https://docs.microsoft.com/en-us/azure/app-service-web/app-service-deploy-local-git

### Using Azure functions core tools

An alternative way to deploy the functions is by using the Azure functions command line interface:

https://github.com/Azure/azure-functions-cli

It works only on Windows systems (at the moment of writing).

To publish your code to the remote Azure function container:

npm install azure-functions-cli
cd digital-citizenship-functions
func azure login
func azure functionapp publish

#### Run functions locally

With the azure-functions-cli you can even [run the functions locally](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local):

func azure functionapp fetch-app-settings <FunctionApp name>
func host start

You will get a running server on http://localhost:7071.
