/*
 * In-memory implementation of an event batcher.
 *
 * `createBatchedFunction` is basically a debounce function, except the function
 * it creates records the data it's passed and will pass the recorded data to
 * the function whenever the batch expires.
 */

export interface BatchRecord<DataType> {
  batchKey: string;
  events: DataType[];
  timeout: number;
  callback: BatchCompletionCallback<DataType>;
}

/** Callback will be passed record with all batched events when batch times out. */
export type BatchCompletionCallback<DataType> = (
  batch: BatchRecord<DataType>
) => void;

/** Each batch is keyed on an arbitrary string. */
export const batchStore: Record<string, BatchRecord<any> | null> = {};

interface EventBatchingOptions {
  waitForMs: number;
}

/**
 * Wraps a function and returns a debounced function, which will keep adding
 * data to the batch when invoked within `waitForMs` milliseconds of the last
 * invocation.
 *
 * The wrapped function will be called with the final result of the batching.
 */
export function createBatchedFunction<DataType = any>(
  callback: BatchCompletionCallback<DataType>,
  options: EventBatchingOptions
) {
  /**
   * When invoked, adds `data` to the batch record identified by the batch key.
   * Sets off a timeout that will invoke the completion callback if this
   * function isn't call on the same key within the `waitForMs` defined in
   * `options`.
   */
  return function executeFunction(batchKey: string, data: DataType) {
    const batch = batchStore[batchKey];
    // If there's no existing record, create a new one.
    if (!batch) {
      batchStore[batchKey] = {
        batchKey,
        events: [data],
        callback,
        timeout: setTriggerBatchTimeout(batchKey, options.waitForMs),
      };

      return;
    }

    // Otherwise, clear the previous timeout, add the newest event, and set a
    // new timeout.
    clearTimeout(batch.timeout);
    batch.events.push(data);
    batch.timeout = setTriggerBatchTimeout(batchKey, options.waitForMs);
  };
}

/**
 * For a given `batchKey`, wait for a certain amount of time before trying to
 * invoke the batch's callback.
 */
function setTriggerBatchTimeout(batchKey: string, waitForMs: number) {
  return setTimeout(() => {
    const batch = batchStore[batchKey];
    if (!batch) throw new Error(`No batch found on trigger for ${batchKey}`);

    batch.callback(batch);
    batchStore[batchKey] = null;
  }, waitForMs);
}
