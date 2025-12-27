import type { LogLevel, LogStyle } from "./types";
import { getConfig } from "./config";

/**
 * ANSI color codes for server console
 * Matches CSS colors from browser console
 */
export const ANSI_COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  // Text colors matching CSS hex values using RGB codes
  // #9CA3AF = rgb(156, 163, 175)
  traceText: "\x1b[38;2;156;163;175m",
  // #22c55e = rgb(34, 197, 94)
  debugText: "\x1b[38;2;34;197;94m",
  // #3b82f6 = rgb(59, 130, 246)
  infoText: "\x1b[38;2;59;130;246m",
  // #eab308 = rgb(234, 179, 8)
  warnText: "\x1b[38;2;234;179;8m",
  // #ef4444 = rgb(239, 68, 68)
  errorText: "\x1b[38;2;239;68;68m",
  // Background colors matching CSS (using darker shades to approximate 20% opacity)
  // rgba(107, 114, 128, 0.2) ≈ rgb(107*0.2, 114*0.2, 128*0.2) ≈ rgb(21, 23, 26)
  traceBg: "\x1b[48;2;21;23;26m",
  // rgba(34, 197, 94, 0.2) ≈ rgb(7, 39, 19)
  debugBg: "\x1b[48;2;7;39;19m",
  // rgba(59, 130, 246, 0.2) ≈ rgb(12, 26, 49)
  infoBg: "\x1b[48;2;12;26;49m",
  // rgba(234, 179, 8, 0.2) ≈ rgb(47, 36, 2)
  warnBg: "\x1b[48;2;47;36;2m",
  // rgba(239, 68, 68, 0.2) ≈ rgb(48, 14, 14)
  errorBg: "\x1b[48;2;48;14;14m",
  // Other colors using RGB codes
  // #8B5CF6 = rgb(139, 92, 246)
  purple: "\x1b[38;2;139;92;246m",
  // #9CA3AF = rgb(156, 163, 175) (same as traceText, used for separators)
  separator: "\x1b[38;2;156;163;175m",
  // #6B7280 = rgb(107, 114, 128)
  source: "\x1b[38;2;107;114;128m",
};

/**
 * Get ANSI color codes for log level badge (server console)
 * Returns both background and text color to match CSS styling
 */
export function getAnsiBadgeStyle(level: LogLevel): {
  bg: string;
  text: string;
  reset: string;
} {
  const reset = ANSI_COLORS.reset;
  switch (level) {
    case "trace":
      return {
        bg: ANSI_COLORS.traceBg,
        text: ANSI_COLORS.traceText,
        reset,
      };
    case "debug":
      return {
        bg: ANSI_COLORS.debugBg,
        text: ANSI_COLORS.debugText,
        reset,
      };
    case "info":
      return {
        bg: ANSI_COLORS.infoBg,
        text: ANSI_COLORS.infoText,
        reset,
      };
    case "warn":
      return {
        bg: ANSI_COLORS.warnBg,
        text: ANSI_COLORS.warnText,
        reset,
      };
    case "error":
      return {
        bg: ANSI_COLORS.errorBg,
        text: ANSI_COLORS.errorText,
        reset,
      };
    default:
      return { bg: "", text: "", reset };
  }
}

/**
 * Get ANSI color code for log level text (server console)
 * @deprecated Use getAnsiBadgeStyle for badge styling
 */
export function getAnsiColor(level: LogLevel): string {
  switch (level) {
    case "trace":
      return ANSI_COLORS.traceText;
    case "debug":
      return ANSI_COLORS.debugText;
    case "info":
      return ANSI_COLORS.infoText;
    case "warn":
      return ANSI_COLORS.warnText;
    case "error":
      return ANSI_COLORS.errorText;
    default:
      return "";
  }
}

/**
 * Get level badge
 */
export function getLevelBadge(level: LogLevel): string {
  const config = getConfig();
  return config.badges[level] || "";
}

/**
 * Get level style (CSS for browser)
 */
export function getLevelStyle(level: LogLevel): string {
  if (level === "silent") return "";
  const config = getConfig();
  const styles = config.styles as LogStyle;
  return styles[level] || "";
}

