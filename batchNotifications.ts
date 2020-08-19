import { assertEquals } from "https://deno.land/std@0.65.0/testing/asserts.ts";
import { delay } from "https://deno.land/std@0.65.0/async/delay.ts";

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

interface Update {
  id: string;
  data: {
    [key: string]: any;
  };
}

Deno.test("should be notified with two batches", async () => {
  const recordedBatches: any[] = [];

  // Callback invoked when batch finishes.
  function sendItemUpdateBatchNotification(record: BatchRecord) {
    recordedBatches.push(record.events);
  }

  const firstBatch: Update[] = [
    { id: "1", data: { backorderQuantity: 15 } },
    { id: "1", data: { backorderQuantity: null } },
  ];

  const secondBatch: Update[] = [{ id: "1", data: { backorderQuantity: 12 } }];

  for (const itemUpdate of firstBatch) {
    notifyInBatch(itemUpdate.id, {
      data: itemUpdate,
      waitForMs: 100,
      callback: sendItemUpdateBatchNotification,
    });
  }

  assertEquals(recordedBatches.length, 0);

  await delay(200);

  for (const itemUpdate of secondBatch) {
    notifyInBatch(itemUpdate.id, {
      data: itemUpdate,
      waitForMs: 100,
      callback: sendItemUpdateBatchNotification,
    });
  }

  assertEquals(recordedBatches.length, 1);
  assertEquals(recordedBatches[0], firstBatch);

  await delay(200);

  const [firstBatchActual, secondBatchActual] = recordedBatches;
  assertEquals(firstBatchActual, firstBatch);
  assertEquals(secondBatchActual, secondBatch);
});
