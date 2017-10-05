# Digital Citizenship APIs

[![CircleCI](https://circleci.com/gh/teamdigitale/digital-citizenship-functions/tree/master.svg?style=svg)](https://circleci.com/gh/teamdigitale/digital-citizenship-functions/tree/master)

[![dependencies](https://david-dm.org/teamdigitale/digital-citizenship-functions/status.svg)](https://david-dm.org/teamdigitale/digital-citizenship-functions)

[![codecov](https://codecov.io/gh/teamdigitale/digital-citizenship-functions/branch/master/graph/badge.svg)](https://codecov.io/gh/teamdigitale/digital-citizenship-functions)

[![Code Climate](https://codeclimate.com/github/teamdigitale/digital-citizenship-functions/badges/gpa.svg)](https://codeclimate.com/github/teamdigitale/digital-citizenship-functions)

[![Test Coverage](https://codeclimate.com/github/teamdigitale/digital-citizenship-functions/badges/coverage.svg)](https://codeclimate.com/github/teamdigitale/digital-citizenship-functions/coverage)

[![Issue Count](https://codeclimate.com/github/teamdigitale/digital-citizenship-functions/badges/issue_count.svg)](https://codeclimate.com/github/teamdigitale/digital-citizenship-functions)

## Introduction

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

## Services provided by the Digital Citizenship API

### Messages

Public administration agencies receive millions of requests every year from
citizens anxious to find out about the progresses of their application or whether
a payment has been received. Citizens have to spend time on hold, which wastes
their time and costs government a lot of money in running call centres.
Moreover citizens forget about or miss payment deadlines costing them overtime
fees.

The messages service makes it easier to keep citizens updated, by helping
service teams across public administration agencies to send text messages,
emails or letters to the citizens.

#### How messages work

Public administration services can send notifications to citizen by calling
the messages API from their web applications, back office systems or batch jobs.
The messages service provides flexibility and resilience by having a number of
SMS, email and post providers. It’s straightforward for us to swap these
providers in and out, based on price, performance etc, with no effort or impact
on government service teams.

The messages service is for sending transactional messages, not for marketing.
There is a risk that marketing messages may be reported as spam, which would
affect delivery rates.

### Preferences

Modern digital services are designed for delivering personalized experiences
to the users. Today, a citizen that wishes to provide personal information and
preferences to the services he uses, has to provide his preferences over and
over again to all services, that's because most public digital services don't
share any information.

The preferences service makes it easier for the citizen to provide his personal
preferences (i.e. contacts information, payment preferences, language, etc...)
in a central repository that digital services across public administration can
use to provide a more personalized digital experience to citizens.

#### How preferences work

Public administration services can query a citizen preferences by calling the
preferences API from their web applications.
The preferences service provides fine control on what preferences attributes a
certain application can read or write, making handling user provided information
safe and painless.

The preferences service is for delivering personalized digital services, not for
collecting citizens emails or mobile numbers. For any transactional
communication need, the messages service must be used.

## Using the Digital Citizenship API

### Trial mode

All new accounts on the Digital Citizenship API start off in trial mode.

This means:

* you can only send messages with email notifications to yourself
* you can only send 50 messages per day

When you’re ready we can remove these restrictions.

### Message sending flow

![message sending flow](docs/message-sending-flow.png)

[Edit diagram](https://www.draw.io/#G0By3amPPe9r4uNWw4NkJQYXk1M3M)

If a notification fails for a certain notification channel because the user
has not configured that channel and you haven't provided a default address
for that channel, nothing can be done.

### Delivery and failure

Our delivery states are:

* Sending
* Delivered
* Phone number or email address not provided
* Technical failure

#### Sending

All messages start in the `Sending` state.

This means that we have accepted the message. It’s waiting in a queue to be
sent to our email or text message delivery partners.

#### Delivered

This means the message is in the person’s email inbox or on his/her phone.

We can’t tell you if they’ve read it – to do so would require invasive and
unreliable tracking techniques.

#### Phone number or email address not provided

You haven't provided any address to reach the citizen (email phone number),
and the citizen you're trying to contact doesn't have any contact preferences
in his profile.

#### Technical failure

This means there is a problem with the connection between the messages API
system andour email or text message delivery partners.

Notifications still being retried are marked as `Sending`. We mark notifications
as `Technical failure` once we’ve given up.

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