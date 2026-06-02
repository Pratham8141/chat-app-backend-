import winston from "winston";
import { config } from "../config/env";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) => {
    if (stack) return `${timestamp} [${level}]: ${message}\n${stack}`;
    return `${timestamp} [${level}]: ${message}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: config.log.level,
  format: config.env === "production" ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
});
