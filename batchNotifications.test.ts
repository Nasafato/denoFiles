import { assertEquals } from "https://deno.land/std@0.65.0/testing/asserts.ts";
import { delay } from "https://deno.land/std@0.65.0/async/delay.ts";

import { createBatchedFunction } from "./batchNotifications.ts";

interface OrderItemUpdate {
  id: string;
  data: Record<string, any>;
}

Deno.test("should create two batches for order 1 and one batch for order 2", async () => {
  const recordedBatches: Record<string, OrderItemUpdate[][]> = {};

  const dispatchUpdateEvent = createBatchedFunction<OrderItemUpdate>(
    (batch) => {
      if (!recordedBatches[batch.batchKey])
        recordedBatches[batch.batchKey] = [];

      recordedBatches[batch.batchKey].push(batch.events);
    },
    { waitForMs: 100 }
  );

  dispatchUpdateEvent("order1", { id: "1", data: { backorderQuantity: 15 } });
  dispatchUpdateEvent("order2", { id: "2", data: { backorderQuantity: 11 } });

  await delay(50);

  dispatchUpdateEvent("order1", {
    id: "1",
    data: { backorderQuantity: null },
  });

  await delay(50);

  // After 100 ms, order 2 batch should have expired, while order 1 hasn't
  // because of the additional event fired after 50 ms.
  assertEquals(recordedBatches.order1, undefined);
  assertEquals(recordedBatches.order2.length, 1);
  assertEquals(recordedBatches.order2[0], [
    { id: "2", data: { backorderQuantity: 11 } },
  ]);

  await delay(50);

  // after another 50 ms, first order 1 batch should have expired.
  assertEquals(recordedBatches.order1.length, 1);
  assertEquals(recordedBatches.order1[0], [
    { id: "1", data: { backorderQuantity: 15 } },
    { id: "1", data: { backorderQuantity: null } },
  ]);

  dispatchUpdateEvent("order1", { id: "1", data: { backorderQuantity: 12 } });

  await delay(100);

  const { order1: order1Batches, order2: order2Batches } = recordedBatches;

  assertEquals(order1Batches.length, 2);
  assertEquals(order1Batches[0], [
    { id: "1", data: { backorderQuantity: 15 } },
    { id: "1", data: { backorderQuantity: null } },
  ]);
  assertEquals(order1Batches[1], [
    { id: "1", data: { backorderQuantity: 12 } },
  ]);

  assertEquals(order2Batches.length, 1);
  assertEquals(order2Batches[0], [
    { id: "2", data: { backorderQuantity: 11 } },
  ]);
});
