/**
 * This function (a queue handler) processes any event
 * triggered when a user's profile is created or updated.
 *
 */
import * as t from "io-ts";
import * as request from "superagent";
import * as winston from "winston";

import { IContext } from "azure-functions-types";
import {
  IProfileCreatedEvent,
  IProfileUpdatedEvent
} from "./controllers/profiles";
import { configureAzureContextTransport } from "./utils/logging";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { ExtendedProfile } from "./api/definitions/ExtendedProfile";
import { NewMessage } from "./api/definitions/NewMessage";
import { getRequiredStringEnv } from "./utils/env";

const ContextWithBindings = t.exact(
  t.interface({
    bindings: t.partial({ notificationEvent: t.object })
  })
);

type ContextWithBindings = t.TypeOf<typeof ContextWithBindings> & IContext;

// HTTP external requests timeout in milliseconds
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Needed to call notifications API
const publicApiUrl = getRequiredStringEnv("PUBLIC_API_URL");
const publicApiKey = getRequiredStringEnv("PUBLIC_API_KEY");

type WelcomeMessages = ReadonlyArray<(p: ExtendedProfile) => NewMessage>;

// TODO: decide text for welcome message
// TODO: switch text based on user's preferred_language
const welcomeMessages: WelcomeMessages = [
  (profile: ExtendedProfile) =>
    NewMessage.decode({
      markdown: `# Hello new user ${profile.email || ""}

  We welcome you to the Digital Citizenship API program  
  This is a welcome message to test if the system works.`,

      subject: `Welcome new user ${profile.email || ""}`
    }).getOrElseL(errs => {
      throw new Error(
        "Invalid MessageContent for welcome message: " + readableReport(errs)
      );
    }),
  (profile: ExtendedProfile) =>
    NewMessage.decode({
      markdown: `# Hello new user ${profile.email || ""}

  We welcome you to the Digital Citizenship API program  
  This is a welcome message to test if the system works.`,

      subject: `Welcome new user ${profile.email || ""}`
      // tslint:disable-next-line:no-identical-functions
    }).getOrElseL(errs => {
      throw new Error(
        "Invalid MessageContent for welcome message: " + readableReport(errs)
      );
    })
];

/**
 * Send a single welcome message using the
 * Digital Citizenship Notification API (REST).
 *
 *  TODO: use italia-commons client with retries
 */
async function sendWelcomeMessage(
  url: string,
  apiKey: string,
  newMessage: NewMessage
): Promise<request.Response> {
  return request("POST", url)
    .set("Content-Type", "application/json")
    .set("Ocp-Apim-Subscription-Key", apiKey)
    .timeout(DEFAULT_REQUEST_TIMEOUT_MS)
    .send(newMessage);
}

/**
 * Send all welcome messages to the user
 * identified by the provided fiscal code.
 */
function sendWelcomeMessages(
  apiUrl: string,
  apiKey: string,
  messages: WelcomeMessages,
  fiscalCode: FiscalCode,
  profile: ExtendedProfile
): ReadonlyArray<Promise<request.Response>> {
  const url = `${apiUrl}/api/v1/messages/${fiscalCode}`;
  winston.debug(
    `ProfileEventsQueueHandler|Sending welcome messages to ${fiscalCode}`
  );
  return messages.map(welcomeMessage =>
    sendWelcomeMessage(url, apiKey, welcomeMessage(profile))
  );
}

export async function index(
  context: ContextWithBindings,
  event: IProfileCreatedEvent | IProfileUpdatedEvent
): Promise<void> {
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);

  winston.debug(
    "ProfileEventsQueueHandler|Received event=%s",
    JSON.stringify(event)
  );

  const isInboxEnabled = event.newProfile.is_inbox_enabled === true;
  const isProfileCreated = event.kind === "ProfileCreatedEvent";
  const hasOldProfileWithInboxDisabled =
    event.kind === "ProfileUpdatedEvent" &&
    event.oldProfile.is_inbox_enabled === false;

  const hasJustEnabledInbox =
    isInboxEnabled && (isProfileCreated || hasOldProfileWithInboxDisabled);

  if (hasJustEnabledInbox) {
    await Promise.all(
      sendWelcomeMessages(
        publicApiUrl,
        publicApiKey,
        welcomeMessages,
        event.fiscalCode,
        event.newProfile
      )
    );
  }
}
