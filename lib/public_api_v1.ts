/**
 * Main entrypoint for the public APIs handlers
 */

import * as express from 'express'

import { DocumentClient as DocumentDBClient } from 'documentdb'

import * as documentDbUtils from './utils/documentdb'

import { createAzureFunctionHandler } from 'azure-function-express-cloudify'

import { MessageModel } from './models/message'
import { ProfileModel } from './models/profile'

import debugHandler from './controllers/debug'
import { CreateMessage, GetMessage, GetMessages } from './controllers/messages'
import { GetProfile, UpdateProfile } from './controllers/profiles'

// Setup Express

const jsonRefs = require('json-refs')
const yaml = require('js-yaml')
const swaggerExpress = require('swagger-express-mw')

const APIs = [
  __dirname + '/../docs/api/notifications-public.yaml',
  __dirname + '/../docs/api/preferences.yaml'
]

const app = express()

// Setup DocumentDB

const COSMOSDB_URI: string = process.env.CUSTOMCONNSTR_COSMOSDB_URI
const COSMOSDB_KEY: string = process.env.CUSTOMCONNSTR_COSMOSDB_KEY

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUrl(
  process.env.COSMOSDB_NAME || 'development'
)
const messagesCollectionUrl = documentDbUtils.getCollectionUrl(
  documentDbDatabaseUrl,
  'messages'
)
const profilesCollectionUrl = documentDbUtils.getCollectionUrl(
  documentDbDatabaseUrl,
  'profiles'
)

const documentClient = new DocumentDBClient(COSMOSDB_URI, {
  masterKey: COSMOSDB_KEY
})

const profileModel = new ProfileModel(documentClient, profilesCollectionUrl)
const messageModel = new MessageModel(documentClient, messagesCollectionUrl)

// Setup handlers

app.get('/xapi/v1/debug', debugHandler)
app.post('/xapi/v1/debug', debugHandler)

app.get('/xapi/v1/profiles/:fiscalcode', GetProfile(profileModel))
app.post('/xapi/v1/profiles/:fiscalcode', UpdateProfile(profileModel))

app.get('/xapi/v1/messages/:fiscalcode/:id', GetMessage(messageModel))
app.get('/xapi/v1/messages/:fiscalcode', GetMessages(messageModel))
app.post('/xapi/v1/messages/:fiscalcode', CreateMessage(messageModel))

/////////////////

const resolveSwaggerSpecs = (apiPath: string) =>
  jsonRefs.resolveRefsAt(apiPath, {
    // Resolve all remote references
    filter: ['relative', 'remote'],
    loaderOptions: {
      processContent: (res: any, cb: any) =>
        cb(undefined, yaml.safeLoad(res.text))
    }
  })

// @see https://github.com/theganyo/swagger-node-runner/releases/tag/v0.6.4
const setSwaggerReponseValidationErrorHandler = () =>
  swaggerExpress.runner.on(
    'responseValidationError',
    (validationResponse: any, req: express.Request, res: express.Response) => {
      const context = req.get('context') as any
      context.log('error in validation')
      context.log(validationResponse.errors)
      console.dir(validationResponse.errors, { depth: 4 })
      res.status(500).json(validationResponse)
    }
  )

const registerSwaggerMiddleware = (config: any) =>
  new Promise((resolve, reject) => {
    swaggerExpress.create(config, (err: Error, swaggerExpress: any) => {
      if (err) {
        reject(err)
        return
      }
      swaggerExpress.register(app)
      setSwaggerReponseValidationErrorHandler()
      resolve(app)
    })
  })

const setUpswaggerApi = (apiPath: string) =>
  resolveSwaggerSpecs(apiPath).then((swaggerSpecs: any) => {
    registerSwaggerMiddleware({
      appRoot: __dirname,
      swagger: swaggerSpecs.resolved
      // swaggerFile: `${__dirname}/api/file.yaml`
    })
  })

Promise.all(APIs.map(setUpswaggerApi)).then(() => {
  console.log('initialized')
})

const handler = createAzureFunctionHandler(app)

// Binds the express app to an Azure Function handler
module.exports = (context: any) => {
  app.set('context', context)
  console.log = context.log
  context.log('started')
  return handler(context)
}
