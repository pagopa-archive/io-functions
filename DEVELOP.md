# Develop Digital Citizenship API

Instructions to set up a local development environment
and start contributing to the Digital Citizenship API.

## System requirements

* [Node.js](https://nodejs.org) 
* [Yarn](https://yarnpkg.com/lang/en/)

Lookup the Node.js version in the [`.node-version`](.node-version) file.

### Azure Functions Tools

In order to execute Azure Functions locally, you need to install
[azure-functions-tools](https://github.com/Azure/azure-functions-core-tools).

### Azure Storage

Digital Citizenship Functions need an active
[Azure Storage Service](https://docs.microsoft.com/en-us/azure/storage/) to run.

The service is provided by Azure so it needs an Azure Subscriptions, but you may opt to use a
[local emulator](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-emulator)
that works with Windows.

An open-source project called [Azurite](https://github.com/Azure/Azurite)
provides a local emulator for Linux based environments. 
It runs locally as well in a dedicated docker container.

## Local Configuration

Functions configuration must reside in a `local.settings.json` file
that must me placed in the project's root. Here's an example:

**Never commit this file !**

```json
{
  "IsEncrypted": false,
  "Values": {
    "QueueStorageConnection": "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;QueueEndpoint=http://localhost:10001/devstoreaccount1;",

    "AzureWebJobsStorage": "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://localhost:10000/devstoreaccount1;QueueEndpoint=http://localhost:10001/devstoreaccount1;",

    // other options ...
  }
}
```

You may use the [Azure Functions Cli](https://github.com/johnpapa/azure-functions-cli)
to setup the configuration strings and/or sync the configuration with the one 
coming from a remote Azure Functions instance.

## Build

Install [yarn](https://yarnpkg.com/) package manager then,
to build the functions from Typescript sources, use:

```sh
$ yarn install      # install npm packages
$ yarn build        # to lint and build
$ yarn test         # run jest unit tests
```

## Run

### From command line

Run the following command to start the application:

```sh
func host start
```

### Using Visual Studio Code

[Visual studio code](https://code.visualstudio.com/) is an editor with a good support
for Typescript and an Azure Functions extension that let run `azure-functions-tools`
directly from inside the IDE.

You can configure Visual Studio Code by adding configuration to 
`.vscode/task.json` and `.vscode/launch.json` local files:

#### task.json

```json
 {
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run Functions Host",
      "identifier": "runFunctionsHost",
      "type": "shell",
      "command": "func host start",
      "isBackground": true,
      "presentation": {
        "reveal": "always"
      },
      "problemMatcher": [
        {
          "owner": "azureFunctions",
          "pattern": [
            {
              "regexp": "\\b\\B",
              "file": 1,
              "location": 2,
              "message": 3
            }
          ],
          "background": {
            "activeOnStart": true,
            "beginsPattern": "^.*Stopping host.*",
            "endsPattern": "^.*Job host started.*"
          }
        }
      ]
    },
    {
      "label": "watch",
      "command": "tsc",
      "type": "shell",
      "args": ["-w", "-p", "."],
      "presentation": {
        "reveal": "silent"
      },
      "isBackground": true,
      "problemMatcher": "$tsc-watch"
    }
  ]
}
```

#### launch.json

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Attach to JavaScript Functions",
            "type": "node",
            "request": "attach",
            "port": 5858,
            "protocol": "inspector",
            "preLaunchTask": "runFunctionsHost"
        }
    ]
}
```

You can now execute and debug the application with `Debug -> Start Debugging`.

### Using Docker

If you have [docker](https://www.docker.com/)
and [docker-compose](https://docs.docker.com/compose/) set up,
you may run `docker-compose up` to execute the Functions runtime locally
without installing `azure-functions-tools`.
