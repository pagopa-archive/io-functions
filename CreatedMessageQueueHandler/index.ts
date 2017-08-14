interface IBindingData {
  queueTrigger?: string;
  expirationTime?: Date;
  insertionTime?: Date;
  nextVisibleTime?: Date;
  id: string;
  popReceipt: string;
  dequeueCount: number;
}

interface IContext {
  bindingData: {
    queueTrigger?: string;
    expirationTime?: Date;
    insertionTime?: Date;
    nextVisibleTime?: Date;
    id: string;
    popReceipt: string;
    dequeueCount: number;
  };
  log: (msg: any, params?: any) => any;
  done: () => void;
}

interface IContextWithBindings extends IContext {
  bindings: {
    createdMessage?: string;
  };
}

interface IMessagePayload {
  messageId?: string;
}

export function index(context: IContextWithBindings) {
  if (context.bindings.createdMessage != null) {
    const message: IMessagePayload = JSON.parse(context.bindings.createdMessage);
    context.log(`Dequeued message [${message.messageId}]`);
  } else {
    context.log(`Fatal! no message found in bindings.`);
    context.done();
  }
}

/*
2017-08-14T13:58:19.356 Queue trigger function processed work item { messageId: '5991ac7944430d3670b81b74' }
2017-08-14T13:58:19.356 queueTrigger = {"messageId":"5991ac7944430d3670b81b74"}
2017-08-14T13:58:19.356 expirationTime = 8/21/2017 1:58:17 PM +00:00
2017-08-14T13:58:19.356 insertionTime = 8/14/2017 1:58:17 PM +00:00
2017-08-14T13:58:19.356 nextVisibleTime = 8/14/2017 2:08:19 PM +00:00
2017-08-14T13:58:19.356 id= 5f149158-92fa-4aaf-84c9-667750fdfaad
2017-08-14T13:58:19.356 popReceipt = AgAAAAMAAAAAAAAAtS7dxwYV0wE=
2017-08-14T13:58:19.356 dequeueCount = 1
*/
