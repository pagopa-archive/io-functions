const shell = require("shelljs")
const program = require("commander")
const CONF = require("./local.config")()

// die on first error
shell.config.fatal = true

// VERBOSE=1 node deploy.js
shell.config.verbose = process.env.VERBOSE === "1"

if (!shell.which("az")) {
  shell.echo(
    "Sorry, this script requires the Azure management cli to be installed"
  )
  shell.exit(1)
}

// Create a resource group if not exists
// az group create \
//       --name $resourceGroupName \
//       --location $location

//////////////////// STORAGE ACCOUNT

const deploy_storageAccount = () =>
  shell.exec(`az storage account create \
    --location ${CONF.location} \
    --name ${CONF.storageName} \
    --resource-group ${CONF.resourceGroupName} \
    --sku ${CONF.storageSku}`)

// As an alternative you may use environment variables:
//   export AZURE_STORAGE_ACCOUNT=<storage_account_name>
//   export AZURE_STORAGE_ACCESS_KEY=<storage_account_key>
//   export AZURE_STORAGE_CONNECTION_STRING=<storage connection string>

const _getStorageAccountConnectionString = () => {
  this.storageAccountConnectionString =
    this.storageAccountConnectionString ||
    shell.exec(
      `az storage account show-connection-string \
    --name ${CONF.storageName} \
    --resource-group ${CONF.resourceGroupName} \
    --query connectionString \
    --output tsv`
    )
  return this.storageAccountConnectionString
}

const deploy_storageContainer = () => {
  const _storageConnectionString = _getStorageAccountConnectionString()
  shell.exec(`az storage container create \
    --name ${CONF.containerName} \
    --connection-string ${_storageConnectionString}`)
}

//////////////////// QUEUES

const deploy_storageQueues = () => {
  const _storageConnectionString = _getStorageAccountConnectionString()
  for (let _queueName of CONF.queueNames) {
    shell.exec(`az storage queue create \
      --name ${_queueName} \
      --connection-string '${_storageConnectionString}'`)
  }
}

//////////////////// DOCUMENTDB

const deploy_comosdb = () =>
  shell.exec(`az cosmosdb create \
          --name ${CONF.cosmosName} \
          --kind GlobalDocumentDB \
          --resource-group ${CONF.resourceGroupName}`)

const _getCosmosDbUri = () => {
  this.cosmosDbUri =
    this.cosmosDbUri ||
    shell.exec(
      `az cosmosdb show -g ${CONF.resourceGroupName} -n ${CONF.cosmosName} --query documentEndpoint -o tsv`
    )
  return this.cosmosDbUri
}

const _getCosmosDbKey = () => {
  this.cosmosDbKey =
    this.cosmosDbKey ||
    shell.exec(
      `az cosmosdb list-keys -g ${CONF.resourceGroupName} -n ${CONF.cosmosName} --query primaryMasterKey -o tsv`
    )
  return this.cosmosDbKey
}

const deploy_comosdbDatabase = () =>
  shell.exec(`az cosmosdb database create \
          --name ${CONF.cosmosName} \
          --db-name ${CONF.databaseName} \
          --resource-group ${CONF.resourceGroupName}`)

const deploy_comosdbCollections = () => {
  for (let _collectionName of CONF.collectionNames) {
    shell.exec(`az cosmosdb collection create \
            --collection-name ${_collectionName} \
            --name ${CONF.cosmosName} \
            --db-name ${CONF.databaseName} \
            --resource-group ${CONF.resourceGroupName}
            }`)
  }
}

//////////////////// APP SERVICE PLAN

const deploy_appServicePlan = () =>
  shell.exec(`az appservice plan create \
    --name ${CONF.appService} \
    --resource-group ${CONF.resourceGroupName} \
    --sku ${CONF.appServiceSku}`)

//////////////////// FUNCTIONS

const deploy_functions = () =>
  shell.exec(`az functionapp create -g ${CONF.resourceGroupName} -p ${CONF.appService} \
    -n ${CONF.functionsName} -s ${CONF.storageName}`)

//////////////////// FUNCTIONS (appsettings)

// You may choose --settings instead of --slot-settings

const deploy_functionSettings = () => {
  const _storageConnectionString = _getStorageAccountConnectionString()
  const _cosmosDbUri = _getCosmosDbUri()
  const _cosmosDbKey = _getCosmosDbKey()

  shell.exec(`az webapp config appsettings set \
    --name ${CONF.functionsName} \
    --resource-group ${CONF.resourceGroupName} \
    --slot-settings "QueueStorageConnection=${_storageConnectionString}"`)

  shell.exec(`az webapp config appsettings set \
    --name ${CONF.functionsName} \
    --resource-group ${CONF.resourceGroupName} \
    --slot-settings "COSMOSDB_NAME=${CONF.databaseName}"`)

  //  Types: {ApiHub, Custom, DocDb, EventHub, MySql, NotificationHub, PostgreSQL,
  //           RedisCache, SQLAzure, SQLServer, ServiceBus}
  shell.exec(`az webapp config connection-string set \
    --connection-string-type Custom \
    --name ${CONF.functionsName} \
    --resource-group ${CONF.resourceGroupName} \
    --slot-settings "COSMOSDB_URI=${_cosmosDbUri}"`)

  shell.exec(`az webapp config connection-string set \
    --connection-string-type Custom \
    --name ${CONF.functionsName} \
    --resource-group ${CONF.resourceGroupName} \
    --slot-settings "COSMOSDB_KEY=${_cosmosDbKey}"`)

  shell.exec(`az webapp config connection-string set \
    --connection-string-type Custom \
    --name ${CONF.functionsName} \
    --resource-group ${CONF.resourceGroupName} \
    --slot-settings "SENDGRID_KEY=${CONF.sendGridKey}"`)
}

//////////////////// FUNCTIONS (git deployment)

// az functionapp deployment user set --user-name $username --password $password

const deploy_functionDeployementSource = () => {
  if (CONF.gitRepoUrl) {
    shell.exec(`az functionapp deployment source config \
      --name ${CONF.functionsName} \
      --repo-url ${CONF.gitRepoUrl} \
      --branch ${CONF.gitRepoBranch} \
      --git-token ${CONF.gitRepoToken} \
      --resource-group ${CONF.resourceGroupName}`)
  }
}

// Configure local Git and get deployment URL
// url=$(az functionapp deployment source config-local-git --name $functionsName \
// --resource-group $resourceGroupName --query url --output tsv)

// Add the Azure remote to your local Git respository and push your code
// git remote add azure $url
// git push azure master

// When prompted for password, use the value of $password that you specified

/// CLEANUP

const delete_functions = () =>
  shell.exec(
    `az functionapp delete -g ${CONF.resourceGroupName} -n ${CONF.functionsName}`
  )

const delete_appService = () =>
  shell.exec(
    `az appservice plan delete -y --name ${CONF.appService} --resource-group ${CONF.resourceGroupName}`
  )

const delete_storageAccount = () =>
  shell.exec(
    `az storage account delete -y --name ${CONF.storageName} --resource-group ${CONF.resourceGroupName}`
  )

const delete_cosmosdb = () =>
  shell.exec(
    `az cosmosdb delete --name ${CONF.cosmosName} --resource-group ${CONF.resourceGroupName}`
  )

///////// PROGRAM

program
  .version("0.1.0")
  .option("--deploy-account", "Deploy storage account")
  .option("--deploy-container", "Deploy storage container")
  .option("--deploy-queues", "Deploy storage queues")
  .option("--deploy-cosmosdb", "Deploy CosmosDB container")
  .option("--deploy-database", "Deploy CosmosDB database")
  .option("--deploy-collections", "Deploy CosmosDB collections")
  .option("--deploy-appservice", "Deploy App Service Plan")
  .option("--deploy-functions", "Deploy Functions")
  .option("--deploy-settings", "Deploy Functions settings")
  .option("--deploy-git", "Deploy Git integration")
  .option("--deploy-all", "Deploy everything")
  .option("--delete-functions", "Remove Functions")
  .option("--delete-appservice", "Remove App Service Plan")
  .option("--delete-account", "Remove storage account")
  .option("--delete-cosmosdb", "Remove CosmosDB")
  .option("--delete-all", "Remove everything")
  .parse(process.argv)

if (program.deployAccount || program.deployAll) {
  console.log("Deploying storage account")
  deploy_storageAccount()
}

if (program.deployContainer || program.deployAll) {
  console.log("Deploying storage container")
  deploy_storageContainer()
}

if (program.deployQueues || program.deployAll) {
  console.log("Deploying storage queues")
  deploy_storageQueues()
}

if (program.deployCosmosdb || program.deployAll) {
  console.log("Deploying CosmosDB")
  deploy_comosdb()
}

if (program.deployDatabase || program.deployAll) {
  console.log("Deploying CosmosDB database")
  deploy_comosdbDatabase()
}

if (program.deployCollections || program.deployAll) {
  console.log("Deploying CosmosDB collections")
  deploy_comosdbCollections()
}

if (program.deployAppservice || program.deployAll) {
  console.log("Deploying App service plan")
  deploy_appServicePlan()
}

if (program.deployFunctions || program.deployAll) {
  console.log("Deploying Functions")
  deploy_functions()
}

if (program.deploySettings || program.deployAll) {
  console.log("Deploying Functions settings")
  deploy_functionSettings()
}

if (program.deployGit || program.deployAll) {
  console.log("Deploying Git integration")
  deploy_functionDeployementSource()
}

/// CLEANUP

if (program.deleteFunctions || program.deleteAll) {
  console.log("Delete Functions")
  delete_functions()
}

if (program.deleteAppservice || program.deleteAll) {
  console.log("Delete App service plan")
  delete_appService()
}

if (program.deleteCosmosdb || program.deleteAll) {
  console.log("Delete CosmosDB")
  delete_cosmosdb()
}

if (program.deleteAccount || program.deleteAll) {
  console.log("Delete App service plan")
  delete_storageAccount()
}
