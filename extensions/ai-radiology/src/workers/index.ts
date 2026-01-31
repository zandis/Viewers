/**
 * Web Workers Module
 * Exports worker pool and utilities for parallel DICOM processing
 */

export { WorkerPool, getWorkerPool, shutdownWorkerPool } from './WorkerPool';
export type {
  WorkerMessage,
  WorkerResponse,
  WorkerMessageType,
} from './dicomWorker';
