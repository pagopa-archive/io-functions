# Development

Instructions and troubleshooting to setup a development environment.


## System Requirements

* Node.js *(check version in `.node-version` file)*
* Yarn *(https://yarnpkg.com/lang/en/)*


## Setup libraries

### Azure Functions Tools

In order to execute Azure Functions locally, you need to install `azure-functions-tools` on your machine. It's available on Windows, OSX and Linux. Please refer to [the official repository](https://github.com/Azure/azure-functions-core-tools) for installation instructions. 

### Azure Storage

As some functions binds to Queue, it's mandatory to provide access to an [Azure Storage Service](https://docs.microsoft.com/en-us/azure/storage/). For development, it's easier rely to a local emulator instance of such service.

#### on Windows

An offical Storage Emulator is provided, please refer to [documentation](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-emulator.

#### on Linux

An open-source project called `Azurite` provides a local emulator for Linux based environments. It runs locally as well in a dedicated docker container. Check out [Azurite's repo](https://github.com/Azure/Azurite) for more informations.


## Local Configuration

### local.settings.json

On production environment, Azure binds functions to the Storage Service. On a local environment, an explicit connection configuration must be provided in a `local.settings.json` file. Place such file at the project's root. Here's an example:
```json
{
  "IsEncrypted": false,
  "Values": {
    "QueueStorageConnection": "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;QueueEndpoint=http://localhost:10001/devstoreaccount1;",

    "AzureWebJobsStorage": "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://localhost:10000/devstoreaccount1;QueueEndpoint=http://localhost:10001/devstoreaccount1;"
  }
}
```
Please don't commit this file.

## Build

Install [yarn](https://yarnpkg.com/) package manager then,
to build the functions from Typescript sources, use:

```sh
$ yarn install      # install npm packages
$ yarn build        # to lint and build
$ yarn test         # run jest unit tests
```


## Run

### Using Terminal

Simply run the following command:
```sh
func host start
```
the application should start and get ready to receive input.

### Using Visual Studio Code

You can configure Visual Studio Code by adding configuration to `.vscode/task.json` and `.vscode/launch.json`. Please refer to Visual Studio Code documentation for further informations.

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

Microsoft itself provides a docker image for running functions on node: https://hub.docker.com/r/microsoft/azure-functions-node8/.

If you are familiare with `docker-compose`, you can get the app up&running with this 2 steps:

1. Create a `docker-compose.yml` file with the following content:
```yml
version: '3'
services:
  func:
    image: microsoft/azure-functions-node8
    volumes:
      - .:/home/site/wwwroot
    environment:
      - AzureWebJobsScriptRoot=/home/site/wwwroot
      - AzureWebJobsStorage=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://storage:10000/devstoreaccount1;QueueEndpoint=http://storage:10001/devstoreaccount1;
    ports: 
      - "8080:80" 
    links: 
      - storage
  
  storage:
    image: arafato/azurite
    ports: 
      - "10000:10000" 
      - "10001:10001"
      - "10002:10002"
    volumes:
      - ./.data:/opt/azurite/folder
```
2. Run `docker-compose up`  





