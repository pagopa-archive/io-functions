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

import { readableReport } from "io-ts-commons/lib/reporters";
import { FiscalCode } from "io-ts-commons/lib/strings";
import { ExtendedProfile } from "./api/definitions/ExtendedProfile";
import { NewMessage } from "./api/definitions/NewMessage";
import { getRequiredStringEnv } from "./utils/env";

import { TelemetryClient } from "applicationinsights";
import { wrapCustomTelemetryClient } from "./utils/application_insights";
import { ulidGenerator } from "./utils/strings";

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

const getCustomTelemetryClient = wrapCustomTelemetryClient(
  isProduction,
  new TelemetryClient()
);

// Needed to call notifications API
const publicApiUrl = getRequiredStringEnv("PUBLIC_API_URL");
const publicApiKey = getRequiredStringEnv("PUBLIC_API_KEY");

type WelcomeMessages = ReadonlyArray<(p: ExtendedProfile) => NewMessage>;

// TODO: internal links
// TODO: switch text based on user's preferred_language
const welcomeMessages: WelcomeMessages = [
  (_: ExtendedProfile) =>
    NewMessage.decode({
      content: {
        markdown: `## Benvenuto su IO, l'applicazione dei servizi pubblici a disposizione di tutti i cittadini italiani!

Scopri le funzioni e impara a usare l'app del cittadino.

IO ti consente di ricevere messaggi dalle Pubbliche Amministrazioni italiane, sia locali che nazionali e all'occorrenza effettuare pagamenti.
Puoi decidere da chi e come essere contattato, dalla sezione [preferenze](ioit://PREFERENCES_HOME) di questa applicazione.
Per esempio puoi decidere di ricevere i messaggi anche sulla tua e-mail associata a SPID.

Se hai già usato pagoPA per effettuare pagamenti verso la Pubblica Amministrazione, potrai vedere lo storico delle transazioni
ed eventuali carte di credito salvate nella sezione [portafoglio](ioit://WALLET_HOME).  
Altrimenti, sempre dal [portafoglio](ioit://WALLET_HOME) puoi aggiungere i tuoi metodi di pagamento preferiti, oppure pagare direttamente
un avviso pagoPA leggendo il QR code di un avviso cartaceo.
Se qualcosa non ti dovesse essere chiaro durante l'utilizzo dell'app, clicca il punto di domanda che trovi in alto a destra.`,

        subject: `Benvenuto!`
      }
    }).getOrElseL(errs => {
      throw new Error(
        "Invalid MessageContent for welcome message: " + readableReport(errs)
      );
    }),
  (_: ExtendedProfile) =>
    NewMessage.decode({
      content: {
        markdown: `## Scopri come attivare o disattivare i servizi delle amministrazioni pubbliche.

Scegli i servizi con cui vuoi interagire nell'app.

Al lancio dell'applicazione la lista dei servizi disponibili comprende tutti quelli a livello nazionale (ad esempio l'ACI)
e quelli relativi ad alcune regioni e ad alcuni comuni, ma non temere: ti scriveranno solo i servizi che hanno
qualcosa di specifico da dire proprio a te! ;-)

Nella sezione [servizi](ioit://PREFERENCES_SERVICES) dentro [preferenze](ioit://PREFERENCES_HOME) puoi scegliere
su quale canale ricevere le comunicazioni di ciascun servizio (notifiche, email, ecc.) e puoi anche decidere
di disattivare eventuali servizi a cui non sei interessato. In quest'ultimo caso i servizi verranno disattivati
da IO: per comunicare con gli enti dovrai utilizzare i canali tradizionali che usavi in precedenza.`,

        subject: `Gestire i servizi in IO`
      }
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

  const appInsightsClient = getCustomTelemetryClient(
    {
      operationId: ulidGenerator()
    },
    {
      fiscalCode: event.fiscalCode
    }
  );

  if (isProfileCreated) {
    // track every new user's registration
    appInsightsClient.trackEvent({
      name: "profile-events.created",
      properties: {
        createdAt: new Date().toISOString(),
        email: event.newProfile.email || "",
        success: "true"
      }
    });
  }

  if (hasJustEnabledInbox) {
    try {
      await Promise.all(
        sendWelcomeMessages(
          publicApiUrl,
          publicApiKey,
          welcomeMessages,
          event.fiscalCode,
          event.newProfile
        )
      );
      appInsightsClient.trackEvent({
        name: "profile-events.welcome-message",
        properties: {
          success: "true"
        }
      });
    } catch (e) {
      appInsightsClient.trackException({
        exception: e,
        properties: {
          type: "profile-events.welcome-message"
        }
      });
    }
  }
}
