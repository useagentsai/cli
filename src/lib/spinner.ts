import ora, { type Ora } from "ora";

export interface Spinner {
  stop(): void;
}

export function startSpinner(text: string, enabled: boolean): Spinner {
  if (!enabled) return { stop() {} };
  const spinner: Ora = ora({ text, stream: process.stderr, isEnabled: true });
  spinner.start();
  return { stop: () => spinner.stop() };
}
