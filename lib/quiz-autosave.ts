import { CourseApiError } from './course-api-client';

function waitForConnection(delay: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    function wake() {
      window.clearTimeout(timer);
      window.removeEventListener('online', wake);
      signal.removeEventListener('abort', wake);
      resolve();
    }
    const timer = window.setTimeout(wake, delay);
    window.addEventListener('online', wake);
    signal.addEventListener('abort', wake);
  });
}

export async function retryQuizSave<T>(
  save: (signal: AbortSignal) => Promise<T>, deadline: number, signal: AbortSignal, onRetry: () => void,
): Promise<T> {
  let delay = 1000;
  for (;;) {
    signal.throwIfAborted();
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Время вышло. Откройте результат, чтобы проверить, какие ответы успели сохраниться.');

    try {
      const timeout = AbortSignal.timeout(Math.min(5000, remaining));
      return await save(AbortSignal.any([signal, timeout]));
    } catch (error) {
      signal.throwIfAborted();
      const transient = error instanceof CourseApiError && (error.status === 0 || error.status === 408 || error.status >= 500);
      if (!transient || deadline - Date.now() <= delay) throw error;
      onRetry();
      await waitForConnection(delay, signal);
      delay = Math.min(delay * 2, 10000);
    }
  }
}
