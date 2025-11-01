// Structured logging using tslog
// Provides consistent logging across the toolkit
// Environment-aware: pretty format for dev, JSON for production

import { Logger } from "tslog";

const mapLogLevel = (level: string): number => {
  const levelMap: Record<string, number> = {
    silly: 0,
    trace: 1,
    debug: 2,
    info: 3,
    warn: 4,
    error: 5,
    fatal: 6,
  };
  return levelMap[level.toLowerCase()] ?? 3;
};

const shouldUseJson = (): boolean => {
  const format = Deno.env.get("LOG_FORMAT");
  if (format === "json") return true;
  if (format === "text") return false;
  return Deno.env.get("DENO_ENV") === "production";
};

const loggerSettings = {
  type: (shouldUseJson() ? "json" : "pretty") as "json" | "pretty",
  minLevel: mapLogLevel(Deno.env.get("LOG_LEVEL") || "info"),
  prettyLogTemplate: "{{yyyy}}.{{mm}}.{{dd}} {{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t",
  prettyErrorTemplate: "\n{{errorName}} {{errorMessage}}\nerror stack:\n{{errorStack}}\n",
  prettyErrorStackTemplate: "  • {{fileName}}:{{lineNumber}}:{{columnNumber}}\t{{methodName}}",
  prettyErrorParentNamesSeparator: ":",
  prettyErrorLoggerNameDelimiter: "\t",
  prettyLogStyles: {
    logLevelName: {
      "*": ["bold", "black", "bgWhiteBright", "dim"],
      FATAL: ["bold", "white", "bgRed"],
      ERROR: ["bold", "red"],
      WARN: ["bold", "yellow"],
      INFO: ["bold", "blue"],
      DEBUG: ["bold", "green"],
      TRACE: ["bold", "magenta"],
      SILLY: ["bold", "gray"],
    },
  },
};

export const logger = new Logger(loggerSettings);

// Optional file logging if LOG_FILE env var is set
if (Deno.env.get("LOG_FILE")) {
  const logFile = Deno.env.get("LOG_FILE")!;
  logger.attachTransport((logObj) => {
    try {
      const logLine = logger.settings.type === "json"
        ? JSON.stringify(logObj) + "\n"
        : logObj.toString() + "\n";
      Deno.writeTextFile(logFile, logLine, { append: true }).catch((err) => {
        console.error(`Failed to write to log file ${logFile}:`, err);
      });
    } catch (err) {
      console.error(`Failed to format log for file ${logFile}:`, err);
    }
  });
}

/**
 * Create a sub-logger with a specific name
 * Useful for module-specific logging contexts
 *
 * @param name Logger name (typically module name)
 * @returns Sub-logger instance
 *
 * @example
 * ```ts
 * const moduleLogger = createSubLogger("vector-store");
 * moduleLogger.info("Table created", { tableName: "documents" });
 * ```
 */
export const createSubLogger = (name: string) => {
  return logger.getSubLogger({ name });
};
