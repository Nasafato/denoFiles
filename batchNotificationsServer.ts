import { notifyInBatch, BatchRecord } from "https://deno.land/x/alan/batchNotifications.ts";

import { assertEquals } from "https://deno.land/std@0.65.0/testing/asserts.ts";
import { delay } from "https://deno.land/std@0.65.0/async/delay.ts";

Deno.test("should be notified with two batches", async () => {
  const recordedBatches: any[] = [];

  // Callback invoked when batch finishes.
  function sendItemUpdateBatchNotification(record: BatchRecord) {
    recordedBatches.push(record.events);
  }

  const firstBatch = [
    { id: "1", data: { backorderQuantity: 15 } },
    { id: "1", data: { backorderQuantity: null } },
  ];

  const secondBatch = [{ id: "1", data: { backorderQuantity: 12 } }];

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
