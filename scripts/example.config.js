// Namespace for resources
// may be changed to any string <= 24 characters
const PREFIX = '<ANY STRING - ONLY LOWERCASE LETTERS AND NUMBERS>'

const CONF = {
  // Mandatory
  resourceGroupName: '<AZURE RESOURCE GROUP NAME>',

  // Mandatory
  sendGridKey: '<SENDGRID API KEY>',

  // Git variables are optional,
  // leave them blank if you don't want git integration
  gitRepoUrl: '<GITHUB URL>',
  gitRepoBranch: '<GITHUB BRANCH NAME>',
  gitRepoToken: '<GITHUB TOKEN WITH REPO GRANTS>',

  storageName: `${PREFIX}`,

  // az account location-list
  location: 'westeurope',

  // {B1, B2, B3, D1, F1, FREE, P1, P2, P3, S1, S2, S3, SHARED}
  appServiceSku: 'S1',

  // Premium_LRS, Standard_GRS, Standard_LRS, Standard_RAGRS, Standard_ZRS
  storageSku: 'Standard_LRS',

  cosmosName: `${PREFIX}-cosmosdb`,

  databaseName: `${PREFIX}-db`,

  collectionNames: ['profiles', 'messages'],

  appService: `${PREFIX}-apps`,

  functionsName: `${PREFIX}-fn`,

  containerName: `${PREFIX}-cont`,

  queueNames: ['emailnotifications', 'createdmessages']
}

module.exports = () => {
  for (const field in Object.keys(CONF)) {
    if (
      !CONF[field] &&
      !field in ['gitRepoUrl', 'gitRepoBranch', 'gitRepoToken']
    ) {
      throw new Error(`Please provide a value for ${field}`)
    }
  }
  return CONF
}
