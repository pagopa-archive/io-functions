# Digital Citizenship APIs

[![CircleCI](https://circleci.com/gh/teamdigitale/digital-citizenship-functions/tree/master.svg?style=svg)](https://circleci.com/gh/teamdigitale/digital-citizenship-functions/tree/master)

[![dependencies](https://david-dm.org/teamdigitale/digital-citizenship-functions/status.svg)](https://david-dm.org/teamdigitale/digital-citizenship-functions)

[![codecov](https://codecov.io/gh/teamdigitale/digital-citizenship-functions/branch/master/graph/badge.svg)](https://codecov.io/gh/teamdigitale/digital-citizenship-functions)

[![Code Climate](https://codeclimate.com/github/teamdigitale/digital-citizenship-functions/badges/gpa.svg)](https://codeclimate.com/github/teamdigitale/digital-citizenship-functions)

[![Test Coverage](https://codeclimate.com/github/teamdigitale/digital-citizenship-functions/badges/coverage.svg)](https://codeclimate.com/github/teamdigitale/digital-citizenship-functions/coverage)

[![Issue Count](https://codeclimate.com/github/teamdigitale/digital-citizenship-functions/badges/issue_count.svg)](https://codeclimate.com/github/teamdigitale/digital-citizenship-functions)

## Overview

This is the implementation of the Digital Citizenship API, a set of services
that enable Public Administrations to deliver modern digital services to
citizens.

The functionality exposed by the Digital Citizenship API focus on end-to-end
communication between the Public Administrations and the citizens and the
delivery of personalized digital services based on the citizen's preferences
(e.g. location, language, etc...).

For further details about the Digital Citizenship initiative, checkout the
[main Digital Citizenship](https://github.com/teamdigitale/cittadinanza-digitale)
repository.

## Architecture

### Design principles

The design of the system strives to follow the functional paradigm as much as possible.

Most data structures are immutable and the vast majority of data models are
versioned and immutably stored in the database.

The business logic is designed to be purely functional and segregated from
the non-functional, non-typesafe parts (interface to the Azure Functions
framework, the database and the Express framework).

### Azure

The API is built on top of the services provided by the Microsoft Azure cloud.
The application logic has been developer on the Azure Functions framework.

### Public resources

The system provides a REST API supporting primarily CRUD operations on (mostly)
persistent resources. Resources match the primitives of the communication and
preferences management modules (i.e., `Messages` and `Profiles`).

### Private resources

Some resources are not publicly exposed and are either for administration use
(`Organizations`) or they're simply hidden from the clients
(i.e. `Notifications`).

### Authentication

Authentication is based on the Azure API Management service.

### Authorization

Access rights to the resources is based on
[scopes](https://zalando.github.io/restful-api-guidelines/index.html#105).
Each scope has a corresponding custom group in the Azure API Management service
(e.g., the `ProfileRead` scope has a corresponding `ProfileRead` group).

Most resources have read and write scopes (e.g. `ProfileRead`, `ProfileWrite`).

API clients can be allowed to any scope by adding the client to the scope's
group in the Azure API Management console (i.e., a client that is part of the
`ProfileRead` and the `ProfileWrite` groups will have read and write rights on
the `profiles` resource).

### Asynchronous processing

Most API operations are synchronous, with the exception of the creation of
messages that will trigger asynchronous notifications on multiple channels
(e.g. email, SMS, push notification, etc.).

Asynchronous operations are handled through queues implemented via Azure Queue
Storage. Events in queue get processed by Azure Functions configured with a
Queue trigger.

### HTTP Request Middlewares

API request handlers get wrapped by a number of _middlewares_ that are
responsible to validate incoming requests and extract information from their
payload (e.g., authentication, payload validation).

### Data flow

The high level flow of the data is the following.

![architecture diagram](docs/digital-citizenship-api.png)

[Edit diagram](https://www.draw.io/#G0By3amPPe9r4udnZUN01uLXRrTWs)

1. An API client sends a request to the public endpoint of the API.
1. The public endpoint forwards the request to the Azure API Management
  system.
1. The Azure API Management system looks up the credentials provided by the
  client and validates them, it will also lookup the groups associated with the
  client.
1. The Azure API Management system forwards the request to the API Function
  implementing the REST API, enriching it with authentication data (e.g., the
  client user ID and the associated groups).
1. The API Function processes the requests. Most CRUD requests will need to
  interact with the data store.
1. If the request created a new `Message`, a _new message_ event gets pushed
  to the _new messages_ queue.
1. A function that maps the _new message_ to the _notifications_ gets
  triggered for each new event consumed from the _new messages_ queue.
1. For each new `Message`, the function will lookup the notification
  preferences for the `Profile` associated to the recipient of the `Message`
  and create a pending `Notification`. If the user enabled the
  _message inbox_, the content of the `Message` will also be persisted
  and associated to the `Message` record in a blob container named `message-content`.
1. In case one or more notification channels have been configured in the
  `Profile` preferences, a _new notification_ gets pushed to each configured
  channel queue (e.g., email, SMS, push notification, etc...).
1. A function responsible for handling _new notification_ for a specific
  notification channel gets triggered.
1. Each _new notification_ event triggers a call to a _channel endpoint_
  (e.g., an MTA, a 3rd party API, etc...) that will send the content of the
  `Notification` to the recipient through the channel.
1. The result of the call is stored in the `Notification`.

### Application events

For monitoring and auditing purposes, the system emits application events to
the Azure Application Insights service.

Currently the system emits the following events:

* `api.messages.create`: when a message gets created (metadata includes
  `senderOrganizationId`, `senderUserId` and `success` status).
* `notification.email.delivery`: when an email notification gets delivered (
  metadata includes `addressSource`, `messageId`, `notificationId` and `mta`).

## Project structure

The API is developed in TypeScript, all code is under the `lib` directory.
Currently the TypeScript code gets compiled to Javascript at deploy time on the
production machine (the build process is triggered by the `deploy.cmd` script).

Each Azure Function is declared in `host.json` and has a top level directory
associated (e.g., `PublicApiV1`). Each function directory contains a
`function.json` that describe the bindings and an `index.ts` that exports the
function handler from the code imported from the `lib` directory.

Each Azure Function has a corresponding `.ts` handler in the `lib` directory
(e.g., `lib/public_api_v1.ts`).

### Code generation from OpenAPI specs

To gain the most from TypeScript's type safety we rely on compile-time code
generation of models from the OpenAPI specs.
This is still a work in process but eventually all code for data models of
requests and responses will likely be generated
from the API specs at compile time.

The OpenAPI specs are located under `api`.

The code is generated by the script `api/generate_models.ts` that uses simple
Jinja templates to translate the specs into TypeScript code.
The generator can be executed with:

```
$ yarn generate-models

// the command will output the models that have been generated
```

_Note_: You'll have to `install -h ts-node` first to make it work.

The generated code will be stored in `lib/api`.

### Code generation from MJML templates

For improved readability on as many devices as possible, we rely on
[MJML](https://mjml.io/) responsive email framework.

The MJML templates live under `templates/mjml`.

The MJML templates gets compiled to Typescript code by the `Makefile`
located in the root folder:

```
make mjml
```

### Unit Tests

Unit tests gets execute using Jest and are located in the `__tests__`
sub-directory of the module under test.