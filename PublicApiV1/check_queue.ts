import * as azure from "azure-storage";

const CREATED_MESSAGES_QUEUE_CONNECTION: string = process.env.CUSTOMCONNSTR_createdmessages;
const CREATED_MESSAGES_QUEUE_NAME = "createdmessages";

const queueService = azure.createQueueService(CREATED_MESSAGES_QUEUE_CONNECTION);

const msg = `test-message-${Date.now()}`;

console.log(`Queing [${msg}] to [${CREATED_MESSAGES_QUEUE_NAME}]`);
queueService.createMessage(CREATED_MESSAGES_QUEUE_NAME, msg, {}, (error) => {
  console.log(`>> message queued [${error}]`);
});
