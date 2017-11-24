// tslint:disable:object-literal-sort-keys

// DO NOT EDIT
// auto-generated by generated_model.ts from admin_api.yaml

export const specs = {
  swagger: "2.0",
  info: {
    version: "0.0.1",
    title: "Digital Citizenship Admin API.",
    description: "Digital Citizenship Admin API."
  },
  basePath: "/adm",
  schemes: ["https"],
  paths: {
    "/service/{service_id}": {
      parameters: [
        {
          name: "service_id",
          in: "path",
          type: "string",
          required: true,
          description: "The ID of an existing Service."
        }
      ],
      get: {
        operationId: "getService",
        summary: "Get Service",
        description:
          "A previously created service with the provided service ID is returned.",
        responses: {
          "200": {
            description: "Service found.",
            schema: { $ref: "#/definitions/AdmService" },
            examples: {
              "application/json": {
                id: "2b3e728c1a5d1efa035c-0000000000000001",
                authorizedRecipients: ["XXXYYY79A95Y000X"],
                departmentName: "dept",
                organizationName: "org",
                serviceId: "2b3e728c1a5d1efa035c",
                serviceName: "service",
                version: 1,
                authorizedCIDRs: []
              }
            }
          },
          "404": { description: "No service found for the provided ID." }
        },
        parameters: []
      },
      put: {
        responses: {
          "200": {
            description: "Service updated.",
            schema: { $ref: "#/definitions/AdmService" },
            examples: {
              "application/json": {
                id: "2b3e728c1a5d1efa035c-0000000000000001",
                authorizedRecipients: ["XXXYYY79A95Y000X"],
                departmentName: "dept",
                organizationName: "org",
                serviceId: "2b3e728c1a5d1efa035c",
                serviceName: "service",
                version: 1,
                authorizedCIDRs: []
              }
            }
          },
          "404": { description: "No service found for the provided ID." }
        },
        summary: "Update Service",
        operationId: "updateService",
        description:
          "Update an existing service with the attributes provided in the request payload.",
        parameters: [
          {
            in: "body",
            name: "body",
            schema: { $ref: "#/definitions/AdmService" },
            description: "The Service payload.",
            "x-examples": {
              "application/json": {
                authorizedRecipients: ["XXXYYY79A95Y000X"],
                departmentName: "dept",
                organizationName: "org",
                serviceId: "2b3e728c1a5d1efa035c",
                serviceName: "service",
                authorizedCIDRs: []
              }
            }
          }
        ]
      }
    },
    "/debug": {
      get: {
        responses: {
          "200": {
            description:
              "Returns a JSON object with HTTP request parameters, headers and payload.",
            schema: { type: "object", properties: {} },
            examples: {
              "application/json": {
                auth: {
                  groups: [
                    "ApiInfoRead",
                    "ApiMessageRead",
                    "ApiLimitedMessageWrite",
                    "ApiDebugRead"
                  ],
                  kind: "IAzureApiAuthorization",
                  subscriptionId: "9d39a48a64370b1b326dfb70307008",
                  userId: "9d39a48a64370b1b326dfb70307008"
                },
                headers: {
                  "cache-control": "no-cache",
                  connection: "Keep-Alive",
                  accept: "application/json",
                  "accept-encoding": "gzip, deflate",
                  "max-forwards": "10",
                  "user-agent": "PostmanRuntime/6.4.1",
                  "ocp-apim-subscription-key": "d5310672bc1d8cf383ca98",
                  "x-user-id": "9d39a48a64370b1b326dfb70307008",
                  "x-user-groups":
                    "Developers,ApiInfoRead,ApiMessageRead,ApiLimitedMessageWrite,ApiDebugRead",
                  "x-subscription-id": "9d39a48a64370b1b326dfb70307008",
                  "x-user-email": "example@example.com",
                  "x-functions-key": "9d39a48a64370b1b326dfb70307008",
                  "x-forwarded-for": "111.97.111.36, 111.40.111.45:1088",
                  "x-waws-unencoded-url": "/adm/debug",
                  "x-original-url": "/adm/debug",
                  "x-arr-log-id": "9d39a48-a64370b-1b326dfb703-07008",
                  "x-forwarded-proto": "https",
                  "content-type": "application/json",
                  "content-length": "0"
                },
                params: {},
                user: {
                  email: "example@example.com",
                  kind: "IAzureUserAttributes",
                  service: {
                    authorizedRecipients: ["XXXBEN86A11Y755X"],
                    departmentName: "dept",
                    organizationName: "org",
                    serviceId: "9d39a48a64370b1b326dfb70307008",
                    serviceName: "service",
                    id: "9d39a48a64370b1b326dfb70307008-0000000000000000",
                    version: 0,
                    authorizedCIDRs: [],
                    kind: "IRetrievedService"
                  }
                }
              }
            }
          },
          "401": {
            description:
              "Returns unauthorized when the API-key if empty or wrong."
          }
        },
        description: "An endpoint to debug GET requests to the API backend.",
        operationId: "getDebug",
        summary: "Debug GET"
      },
      post: {
        responses: {
          "200": {
            description:
              "Returns a JSON object with HTTP request parameters, headers and payload.",
            schema: { type: "object", properties: {} },
            examples: {
              "application/json": {
                auth: {
                  groups: [
                    "ApiInfoRead",
                    "ApiMessageRead",
                    "ApiLimitedMessageWrite",
                    "ApiDebugRead"
                  ],
                  kind: "IAzureApiAuthorization",
                  subscriptionId: "9d39a48a64370b1b326dfb70307008",
                  userId: "9d39a48a64370b1b326dfb70307008"
                },
                headers: {
                  "cache-control": "no-cache",
                  connection: "Keep-Alive",
                  accept: "application/json",
                  "accept-encoding": "gzip, deflate",
                  "max-forwards": "10",
                  "user-agent": "PostmanRuntime/6.4.1",
                  "ocp-apim-subscription-key": "d5310672bc1d8cf383ca98",
                  "x-user-id": "9d39a48a64370b1b326dfb70307008",
                  "x-user-groups":
                    "Developers,ApiInfoRead,ApiMessageRead,ApiLimitedMessageWrite,ApiDebugRead",
                  "x-subscription-id": "9d39a48a64370b1b326dfb70307008",
                  "x-user-email": "example@example.com",
                  "x-functions-key": "9d39a48a64370b1b326dfb70307008",
                  "x-forwarded-for": "111.97.111.36, 111.40.111.45:1088",
                  "x-waws-unencoded-url": "/adm/debug",
                  "x-original-url": "/adm/debug",
                  "x-arr-log-id": "9d39a48-a64370b-1b326dfb703-07008",
                  "x-forwarded-proto": "https",
                  "content-type": "application/json",
                  "content-length": "0"
                },
                params: {},
                user: {
                  email: "example@example.com",
                  kind: "IAzureUserAttributes",
                  service: {
                    authorizedRecipients: ["XXXBEN86A11Y755X"],
                    departmentName: "dept",
                    organizationName: "org",
                    serviceId: "9d39a48a64370b1b326dfb70307008",
                    serviceName: "service",
                    id: "9d39a48a64370b1b326dfb70307008-0000000000000000",
                    version: 0,
                    authorizedCIDRs: [],
                    kind: "IRetrievedService"
                  }
                }
              }
            }
          }
        },
        description: "An endpoint to debug POST requests to the API backend.",
        summary: "Debug POST"
      }
    },
    "/service": {
      post: {
        responses: {
          "200": {
            description: "Service created.",
            schema: { $ref: "#/definitions/AdmService" },
            examples: {
              "application/json": {
                id: "2b3e728c1a5d1efa035c-0000000000000001",
                authorizedRecipients: ["XXXYYY79A95Y000X"],
                departmentName: "dept",
                organizationName: "org",
                serviceId: "2b3e728c1a5d1efa035c",
                serviceName: "service",
                version: 1,
                authorizedCIDRs: []
              }
            }
          }
        },
        summary: "Create Service",
        description:
          "Create a new Service with the attributes provided in the requst payload.",
        operationId: "createService",
        parameters: [
          {
            in: "body",
            name: "body",
            schema: { $ref: "#/definitions/AdmService" },
            description: "The Service payload.",
            "x-examples": {
              "application/json": {
                authorizedRecipients: ["XXXYYY79A95Y000X"],
                departmentName: "dept",
                organizationName: "org",
                serviceId: "2b3e728c1a5d1efa035c",
                serviceName: "service",
                authorizedCIDRs: []
              }
            }
          }
        ]
      }
    }
  },
  definitions: {
    AdmService: {
      title: "AdmService",
      description: "A Service tied to an user's subscription.",
      type: "object",
      properties: {
        serviceId: {
          type: "string",
          description:
            "The ID of the Service. Equals the subscriptionId of a registered API user."
        },
        serviceName: {
          type: "string",
          description:
            "The name of the service. Will be added to the content of sent messages."
        },
        organizationName: {
          type: "string",
          description:
            "The organizazione that runs the service. Will be added to the content of sent messages to identify the sender."
        },
        departmentName: {
          type: "string",
          description:
            "The departmenet inside the organization that runs the service. Will be added to the content of sent messages."
        },
        authorizedCIDRs: {
          type: "array",
          items: { $ref: "#/definitions/AdmCidr" }
        },
        authorizedRecipients: {
          type: "array",
          items: { $ref: "#/definitions/AdmFiscalCode" }
        },
        version: { type: "integer" },
        id: { type: "string" }
      },
      required: [
        "serviceId",
        "serviceName",
        "organizationName",
        "departmentName",
        "authorizedCIDRs",
        "authorizedRecipients"
      ]
    },
    AdmCidr: {
      type: "string",
      title: "AdmCidr",
      description: "Describes a single IP or a range of IPs.",
      pattern: "([0-9]{1,3}\\.){3}[0-9]{1,3}(\\/([0-9]|[1-2][0-9]|3[0-2]))?"
    },
    AdmFiscalCode: {
      type: "string",
      title: "AdmFiscalCode",
      description: "An authorized Fiscal Code.",
      minLength: 16,
      maxLength: 16,
      pattern:
        "[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]"
    }
  },
  responses: {},
  parameters: {},
  consumes: ["application/json"],
  produces: ["application/json"],
  securityDefinitions: {
    SubscriptionKey: {
      type: "apiKey",
      name: "Ocp-Apim-Subscription-Key",
      in: "header",
      description: "The API key obtained through the developer portal."
    }
  },
  host: "localhost",
  security: [{ SubscriptionKey: [] }]
};
