const $ = require('shelljs')
const CONF = require('./local.config')()

// VERBOSE=1 node deploy.js
$.config.verbose = !!process.env.VERBOSE || false

$.exec(
  `az functionapp delete -g ${CONF.resourceGroupName} -n ${CONF.functionsName}`
)

$.exec(
  `az appservice plan delete -y --name ${CONF.appService} --resource-group ${CONF.resourceGroupName}`
)

$.exec(
  `az storage account delete -y --name ${CONF.storageName} --resource-group ${CONF.resourceGroupName}`
)

$.exec(
  `az cosmosdb delete --name ${CONF.cosmosName} --resource-group ${CONF.resourceGroupName}`
)

// Alternative (better) cleanup procedure
//   if you have got the rights:
// $.exec(az group delete --name $resourceGroupName)
