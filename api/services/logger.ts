import { getAuthedUserId } from "./auth.js";
import { query, queryOne } from "./db.js";
import type { ApiRequest } from "../utils/types.js";
import path from "path";
import fs from "fs";

export type LogSeverity = "info" | "warning" | "error" | "critical";
export type LogStatus = "success" | "failure";

export interface LogEventOptions {
  action: string;
  resource: string;
  oldValue?: string | null | Record<string, unknown>;
  newValue?: string | null | Record<string, unknown>;
  severity?: LogSeverity;
  status?: LogStatus;
  metadata?: Record<string, unknown>;
  userId?: string | null;
  userEmail?: string | null;
}

export interface SystemLogEntry {
  id?: string;
  timestamp?: string;
  action: string;
  resource: string;
  oldValue: string | null;
  newValue: string | null;
  userId: string | null;
  userEmail: string | null;
  severity: LogSeverity;
  status: LogStatus;
  metadata: Record<string, unknown>;
}

// Global active WebSocket client list
export const activeWsClients = new Set<any>();

let isTableChecked = false;

export async function ensureSystemLogsTable() {
  if (isTableChecked) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email TEXT,
        severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
        status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure')),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `);
    
    await query(`CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity);`);
    
    isTableChecked = true;
  } catch (error) {
    console.error("❌ Failed to ensure system_logs table:", error);
  }
}

// Async queue variables
const logQueue: SystemLogEntry[] = [];
let isProcessing = false;

// Log Rotation configuration
const LOG_FILE_PATH = path.join(process.cwd(), "logs", "system.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB limit per file

/**
 * Public function to log an event.
 * Handles user parsing, credentials masking, and queues the log asynchronously.
 */
export async function logEvent(
  req: ApiRequest | null,
  options: LogEventOptions
): Promise<void> {
  try {
    // Rework: Only log transaction actions (TRANSACTION_CREATED, TRANSACTION_EDITED, TRANSACTION_DELETED)
    if (!options.action.startsWith("TRANSACTION_")) {
      return;
    }

    let finalUserId = options.userId || null;
    let finalUserEmail = options.userEmail || null;

    // Resolve user details asynchronously if request is supplied
    if (!finalUserId && req) {
      finalUserId = await getAuthedUserId(req);
    }
    if (finalUserId && !finalUserEmail) {
      try {
        const user = await queryOne<{ email: string }>(
          "SELECT email FROM users WHERE id = $1",
          [finalUserId]
        );
        finalUserEmail = user?.email || null;
      } catch (dbErr) {
        console.warn("⚠️ Failed to resolve user email for log:", dbErr);
      }
    }

    // Stringify oldValue and newValue if they are objects
    const stringifyVal = (val: any): string | null => {
      if (val == null) return null;
      if (typeof val === "object") return JSON.stringify(val);
      return String(val);
    };

    const entry: SystemLogEntry = {
      action: options.action,
      resource: options.resource,
      oldValue: stringifyVal(options.oldValue),
      newValue: stringifyVal(options.newValue),
      userId: finalUserId,
      userEmail: finalUserEmail,
      severity: options.severity || "info",
      status: options.status || "success",
      metadata: options.metadata || {},
    };

    // Print readable message to the terminal console
    logToConsole(entry);

    if (!process.env.VERCEL) {
      // Write log to rotation file (non-blocking)
      writeToFileLog(entry).catch((err) =>
        console.error("❌ Failed to write file log:", err)
      );

      // Queue log for database persistent storage and WebSocket push
      queueLog(entry);
    } else {
      // On Vercel (production), write directly to database and await it to prevent losing logs during container freeze
      await writeLogToDb(entry).catch((err) =>
        console.error("❌ Failed to write DB log in serverless:", err)
      );
    }
  } catch (err) {
    console.error("💥 Critical failure in logging engine:", err);
  }
}

/**
 * Log entry directly to standard console with simple coloring
 */
function logToConsole(entry: SystemLogEntry) {
  const iconMap: Record<LogSeverity, string> = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    critical: "🚨",
  };
  const icon = iconMap[entry.severity] || "📝";
  const user = entry.userEmail ? `by ${entry.userEmail}` : "(system)";
  console.log(
    `[LOG] ${icon} [${entry.severity.toUpperCase()}] ${entry.action} on "${entry.resource}" ${user} - Status: ${entry.status}`
  );
}

/**
 * Pushes log into queue buffer and processes it asynchronously
 */
function queueLog(log: SystemLogEntry) {
  logQueue.push(log);
  processQueue();
}

/**
 * Queue processing loop
 */
async function processQueue() {
  if (isProcessing || logQueue.length === 0) return;
  isProcessing = true;

  const batch = logQueue.splice(0, 10);
  try {
    for (const log of batch) {
      // 1. Insert into database
      await writeLogToDb(log);

      // 2. Broadcast via WebSocket
      broadcastLog(log);
    }
  } catch (err) {
    console.error("Logger queue batch write failed, retrying in 5 seconds...", err);
    // Return items to the front of the queue
    logQueue.unshift(...batch);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } finally {
    isProcessing = false;
    if (logQueue.length > 0) {
      setTimeout(processQueue, 100);
    }
  }
}

/**
 * Inserts log into Neon database system_logs table
 */
async function writeLogToDb(log: SystemLogEntry) {
  try {
    await ensureSystemLogsTable();
    const maskedOld = maskSensitiveData(log.oldValue);
    const maskedNew = maskSensitiveData(log.newValue);
    const maskedMeta = maskSensitiveData(log.metadata);

    await query(
      `
      INSERT INTO system_logs (action, resource, old_value, new_value, user_id, user_email, severity, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
      [
        log.action,
        log.resource,
        maskedOld,
        maskedNew,
        log.userId,
        log.userEmail,
        log.severity,
        log.status,
        JSON.stringify(maskedMeta || {}),
      ]
    );
  } catch (err) {
    console.error("Database log write failed:", err);
    throw err; // bubble up to queue retry
  }
}

/**
 * Broadcasts logs to all connected WebSocket clients
 */
function broadcastLog(log: SystemLogEntry) {
  const logMsg = JSON.stringify({
    ...log,
    id: log.id || Math.random().toString(36).substring(7),
    timestamp: log.timestamp || new Date().toISOString(),
    oldValue: maskSensitiveData(log.oldValue),
    newValue: maskSensitiveData(log.newValue),
    metadata: maskSensitiveData(log.metadata),
  });

  for (const client of activeWsClients) {
    try {
      client.send(logMsg);
    } catch (err) {
      activeWsClients.delete(client);
    }
  }
}

/**
 * Local file-based logger with rotation support
 */
async function writeToFileLog(log: SystemLogEntry) {
  try {
    if (process.env.VERCEL) return;

    ensureLogDirectory();

    // Rotate log file if it exceeds 5MB
    if (fs.existsSync(LOG_FILE_PATH)) {
      const stats = fs.statSync(LOG_FILE_PATH);
      if (stats.size > MAX_LOG_SIZE) {
        await rotateLogFile();
      }
    }

    const logLine =
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...log,
        oldValue: maskSensitiveData(log.oldValue),
        newValue: maskSensitiveData(log.newValue),
        metadata: maskSensitiveData(log.metadata),
      }) + "\n";

    if (typeof Bun !== "undefined") {
      await Bun.write(LOG_FILE_PATH, logLine, { append: true });
    } else {
      await fs.promises.appendFile(LOG_FILE_PATH, logLine);
    }
  } catch (err) {
    console.error("Failed to write to file log:", err);
  }
}

function ensureLogDirectory() {
  const dir = path.dirname(LOG_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function rotateLogFile() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rotatedPath = path.join(
      process.cwd(),
      "logs",
      `system-${timestamp}.log`
    );

    // Rename current log file to rotated file name
    fs.renameSync(LOG_FILE_PATH, rotatedPath);
    console.log(`🔄 Rotated log file to ${rotatedPath}`);

    // Clean old rotated files, retaining only the last 7
    cleanOldLogFiles();
  } catch (err) {
    console.error("Log file rotation failed:", err);
  }
}

function cleanOldLogFiles() {
  try {
    const logDir = path.dirname(LOG_FILE_PATH);
    const files = fs
      .readdirSync(logDir)
      .filter((f) => f.startsWith("system-") && f.endsWith(".log"))
      .map((f) => ({
        name: f,
        path: path.join(logDir, f),
        time: fs.statSync(path.join(logDir, f)).mtimeMs,
      }));

    if (files.length > 7) {
      // Sort oldest first
      files.sort((a, b) => a.time - b.time);
      const toDelete = files.slice(0, files.length - 7);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Deleted old rotated log file: ${file.name}`);
      }
    }
  } catch (err) {
    console.error("Cleaning old log files failed:", err);
  }
}

/**
 * Mask sensitive credentials inside strings, objects, or JSON records
 */
function maskSensitiveData(value: any): any {
  if (value == null) return value;

  if (typeof value === "string") {
    // Try to parse string as JSON object first
    try {
      const obj = JSON.parse(value);
      if (typeof obj === "object" && obj !== null) {
        return JSON.stringify(maskObject(obj));
      }
    } catch {}

    return value;
  }

  if (typeof value === "object") {
    return maskObject(value);
  }

  return value;
}

function maskObject(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveData);
  }

  const masked: any = {};
  const sensitiveKeys = [
    "password",
    "encrypted_password",
    "key",
    "token",
    "secret",
    "api_key",
    "apikey",
    "auth_secret",
    "authorization",
  ];

  for (const [k, v] of Object.entries(obj)) {
    const isSensitive = sensitiveKeys.some((key) =>
      k.toLowerCase().includes(key)
    );
    if (isSensitive) {
      masked[k] = "********";
    } else if (typeof v === "object" && v !== null) {
      masked[k] = maskObject(v);
    } else {
      masked[k] = v;
    }
  }
  return masked;
}
