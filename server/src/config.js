import path from "node:path";

export function loadConfig(env = process.env) {
  const rawPort = env.PORT ?? "3001";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT value: "${rawPort}". Expected integer 1..65535.`,
    );
  }

  const rawLogsDir = env.LOGS_DIR ?? "./logs";
  if (typeof rawLogsDir !== "string" || rawLogsDir.trim() === "") {
    throw new Error("Invalid LOGS_DIR value: expected non-empty path.");
  }

  const logsDir = path.resolve(process.cwd(), rawLogsDir.trim());

  const rawMaxPayload = env.MAX_WS_PAYLOAD_BYTES ?? "4096";
  const maxPayloadBytes = Number(rawMaxPayload);
  if (!Number.isInteger(maxPayloadBytes) || maxPayloadBytes < 64) {
    throw new Error(
      `Invalid MAX_WS_PAYLOAD_BYTES value: "${rawMaxPayload}". Expected integer >= 64.`,
    );
  }

  return {
    port,
    logsDir,
    maxPayloadBytes,
  };
}
