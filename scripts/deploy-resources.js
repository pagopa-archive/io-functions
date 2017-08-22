const $ = require('shelljs')
const CONF = require('./local.config')()

// die on first error
$.config.fatal = true

// VERBOSE=1 node deploy.js
$.config.verbose = !!process.env.VERBOSE || false

// Create a resource group if not exists
// az group create \
//       --name $resourceGroupName \
//       --location $location

//////////////////// STORAGE ACCOUNT

$.exec(`az storage account create \
    --location ${CONF.location} \
    --name ${CONF.storageName} \
    --resource-group ${CONF.resourceGroupName} \
    --sku ${CONF.storageSku}`)

// As an alternative you may use environment variables:
//   export AZURE_STORAGE_ACCOUNT=<storage_account_name>
//   export AZURE_STORAGE_ACCESS_KEY=<storage_account_key>
//   export AZURE_STORAGE_CONNECTION_STRING=<storage connection string>

const _storageConnectionString = $.exec(
  `az storage account show-connection-string \
     --name ${CONF.storageName} \
     --resource-group ${CONF.resourceGroupName} \
     --query connectionString \
     --output tsv`
)

$.exec(`az storage container create \
  --name ${CONF.containerName} \
  --connection-string ${_storageConnectionString}`)

//////////////////// QUEUES

for (_queueName of CONF.queueNames) {
  $.exec(`az storage queue create \
    --name ${_queueName} \
    --connection-string '${_storageConnectionString}'`)
}

//////////////////// DOCUMENTDB

$.exec(`az cosmosdb create \
        --name ${CONF.cosmosName} \
        --kind GlobalDocumentDB \
        --resource-group ${CONF.resourceGroupName}`)

const _cosmosDbUri = $.exec(
  `az cosmosdb show -g ${CONF.resourceGroupName} -n ${CONF.cosmosName} --query documentEndpoint -o tsv`
)

const _cosmosDbKey = $.exec(
  `az cosmosdb list-keys -g ${CONF.resourceGroupName} -n ${CONF.cosmosName} --query primaryMasterKey -o tsv`
)

$.exec(`az cosmosdb database create \
        --name ${CONF.cosmosName} \
        --db-name ${CONF.databaseName} \
        --resource-group ${CONF.resourceGroupName}`)

for (_collectionName of CONF.collectionNames) {
  $.exec(`az cosmosdb collection create \
          --collection-name ${_collectionName} \
          --name ${CONF.cosmosName} \
          --db-name ${CONF.databaseName} \
          --resource-group ${CONF.resourceGroupName}
          }`)
}

//////////////////// APP SERVICE PLAN

$.exec(`az appservice plan create \
  --name ${CONF.appService} \
  --resource-group ${CONF.resourceGroupName} \
  --sku ${CONF.appServiceSku}`)

//////////////////// FUNCTIONS

$.exec(`az functionapp create -g ${CONF.resourceGroupName} -p ${CONF.appService} \
  -n ${CONF.functionsName} -s ${CONF.storageName}`)

//////////////////// FUNCTIONS (appsettings)

// You may choose --settings instead of --slot-settings

$.exec(`az webapp config appsettings set \
  --name ${CONF.functionsName} \
  --resource-group ${CONF.resourceGroupName} \
  --slot-settings "QueueStorageConnection=${_storageConnectionString}"`)

$.exec(`az webapp config appsettings set \
  --name ${CONF.functionsName} \
  --resource-group ${CONF.resourceGroupName} \
  --slot-settings "COSMOSDB_NAME=${CONF.databaseName}"`)

//  Types: {ApiHub, Custom, DocDb, EventHub, MySql, NotificationHub, PostgreSQL,
//           RedisCache, SQLAzure, SQLServer, ServiceBus}
$.exec(`az webapp config connection-string set \
  --connection-string-type Custom \
  --name ${CONF.functionsName} \
  --resource-group ${CONF.resourceGroupName} \
  --slot-settings "COSMOSDB_URI=${_cosmosDbUri}"`)

$.exec(`az webapp config connection-string set \
  --connection-string-type Custom \
  --name ${CONF.functionsName} \
  --resource-group ${CONF.resourceGroupName} \
  --slot-settings "COSMOSDB_KEY=${_cosmosDbKey}"`)

$.exec(`az webapp config connection-string set \
  --connection-string-type Custom \
  --name ${CONF.functionsName} \
  --resource-group ${CONF.resourceGroupName} \
  --slot-settings "SENDGRID_KEY=${CONF.sendGridKey}"`)

//////////////////// FUNCTIONS (git deployment)

// az functionapp deployment user set --user-name $username --password $password

if (CONF.gitRepoUrl !== '') {
  $.exec(`az functionapp deployment source config \
    --name ${CONF.functionsName} \
    --repo-url ${CONF.gitRepoUrl} \
    --branch ${CONF.gitRepoBranch} \
    --git-token ${CONF.gitRepoToken} \
    --resource-group ${CONF.resourceGroupName}`)
}

// Configure local Git and get deployment URL
// url=$(az functionapp deployment source config-local-git --name $functionsName \
// --resource-group $resourceGroupName --query url --output tsv)

// Add the Azure remote to your local Git respository and push your code
// git remote add azure $url
// git push azure master

// When prompted for password, use the value of $password that you specified
