import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "authorization",
      "vt.apiKey",
      "gsb.apiKey",
    ],
    remove: true,
  },
});
