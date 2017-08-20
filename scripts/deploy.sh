#!/bin/bash

source ./variables.sh

# Create a resource group if not exists
# az group create \
#       --name $resourceGroupName \
#       --location $location

########## STORAGE ACCOUNT

az storage account create \
    --location $location \
    --name $storageName \
    --resource-group $resourceGroupName \
    --sku $storageSku

# As an alternative you may use environment variables:
#   export AZURE_STORAGE_ACCOUNT=<storage_account_name>
#   export AZURE_STORAGE_ACCESS_KEY=<storage_account_key>
#   export AZURE_STORAGE_CONNECTION_STRING=<storage connection string>

storageConnectionString=$(az storage account show-connection-string \
     --name $storageName \
     --resource-group $resourceGroupName \
     --query connectionString \
     --output tsv)

az storage container create \
  --connection-string $storageConnectionString \
  --name $containerName

########## QUEUES

for queueName in ${queueNames[@]}
do
  az storage queue create \
    --connection-string $storageConnectionString \
    --name $queueName
done

########## DOCUMENTDB

az cosmosdb create \
        --name $cosmosname \
        --kind GlobalDocumentDB \
        --resource-group $resourceGroupName \
        --max-interval 10 \
        --max-staleness-prefix 200

az cosmosdb database create \
        --name $cosmosname \
        --db-name $databaseName \
        --resource-group $resourceGroupName

az cosmosdb collection create \
        --collection-name $collectionName \
        --name $cosmosname \
        --db-name $databaseName \
        --resource-group $resourceGroupName

########## APP SERVICE PLAN

az appservice plan create \
  --name $appService \
  --resource-group $resourceGroupName \
  --sku $appServiceSku

########## FUNCTIONS

az functionapp create -g $resourceGroupName -p $appService -n $functionsName -s $storageName

########## FUNCTIONS (git deployment)

# az functionapp deployment user set --user-name $username --password $password

# Configure local Git and get deployment URL
# url=$(az functionapp deployment source config-local-git --name $functionsName \
# --resource-group $resourceGroupName --query url --output tsv)

# Add the Azure remote to your local Git respository and push your code
# git remote add azure $url
# git push azure master

# When prompted for password, use the value of $password that you specified
