#!/bin/bash

if [ -f "local.variables.sh" ]; then
  source ./local.variables.sh
fi

prefix="001"

resourceGroupName="teamdigitale"

# cannot contain dashes - only lowercase characters or numbers
storageName="${prefix}"

location="westeurope"

# {B1, B2, B3, D1, F1, FREE, P1, P2, P3, S1, S2, S3, SHARED}
appServiceSku="S1"

# Premium_LRS, Standard_GRS, Standard_LRS, Standard_RAGRS, Standard_ZRS
storageSku="Standard_LRS"

sendGridKey="$SEND_GRID_KEY"
if [ -z $sendGridKey ]; then
  echo "Please provide a value for SEND_GRID_KEY"
  exit 1
fi

# Git variables are optional,
# leave them blank if you don't want git integration
gitRepoUrl="$GIT_REPO_URL"
gitRepoBranch="$GIT_REPO_BRANCH"
gitRepoToken="$GIT_REPO_TOKEN"

cosmosName="${prefix}-cosmosdb"

databaseName="${prefix}-db"

collectionNames=("profiles" "messages")

appService="${prefix}-apps"

functionsName="${prefix}-fn"

containerName="${prefix}-cont"

queueNames=("emailnotifications" "createdmessages")
