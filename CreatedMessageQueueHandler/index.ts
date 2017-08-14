export function index(context: any) {
  context.log("Queue trigger function processed work item", context.bindings.createdMessage);
  context.log("queueTrigger =", context.bindingData.queueTrigger);
  context.log("expirationTime =", context.bindingData.expirationTime);
  context.log("insertionTime =", context.bindingData.insertionTime);
  context.log("nextVisibleTime =", context.bindingData.nextVisibleTime);
  context.log("id=", context.bindingData.id);
  context.log("popReceipt =", context.bindingData.popReceipt);
  context.log("dequeueCount =", context.bindingData.dequeueCount);
  context.done();
}
