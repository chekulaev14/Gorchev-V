import { describe, it, expect } from 'vitest';
import { getLogger, runWithRequestId, getRequestId } from '../logger';

describe('logger', () => {
  it('создаёт логгер', () => {
    const logger = getLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });

  it('runWithRequestId сохраняет requestId в ALS', async () => {
    let capturedId: string | undefined;
    await runWithRequestId('test-req-123', async () => {
      capturedId = getRequestId();
    });
    expect(capturedId).toBe('test-req-123');
  });

  it('getRequestId возвращает undefined вне контекста', () => {
    expect(getRequestId()).toBeUndefined();
  });
});
