export interface BatchRecord {
  batchKey: string;
  events: Record<string, any>[];
  timeout: number;
  callback: BatchCompletionCallback;
}

export const batchStore: Record<string, BatchRecord | null> = {};
export type BatchCompletionCallback = (record: BatchRecord) => void;

export function notifyInBatch(
  batchKey: string,
  options: {
    data: any;
    waitForMs: number;
    callback: BatchCompletionCallback;
  }
) {
  const record = batchStore[batchKey];
  if (!record) {
    batchStore[batchKey] = {
      batchKey,
      events: [options.data],
      callback: options.callback,
      timeout: setBatchTrigger(batchKey, options.waitForMs),
    };

    return;
  }

  clearTimeout(record.timeout);
  record.events.push(options.data);
  record.timeout = setBatchTrigger(batchKey, options.waitForMs);
}

function setBatchTrigger(batchKey: string, waitForMs: number) {
  return setTimeout(() => {
    const record = batchStore[batchKey];
    if (!record) throw new Error(`No record found on trigger for ${batchKey}`);

    record.callback(record);
    batchStore[batchKey] = null;
  }, waitForMs);
}
