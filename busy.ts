// Counts the loads that are running and shows a spinner while any of them is running.
type Listener = (count: number) => void;

let count = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn(count);
}

export function subscribeBusy(fn: Listener): () => void {
  listeners.add(fn);
  fn(count);
  return () => {
    listeners.delete(fn);
  };
}

// Runs one load with the spinner on.
export async function withBusy<T>(task: () => Promise<T>): Promise<T> {
  count += 1;
  emit();
  try {
    return await task();
  } finally {
    count = Math.max(0, count - 1);
    emit();
  }
}
