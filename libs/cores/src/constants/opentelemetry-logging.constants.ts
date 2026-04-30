// map SeverityNumber
// https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
export const PinoLevelToSeverityNumber = {
  10: 1, // TRACE
  20: 5, // DEBUG
  30: 9, // INFO
  40: 13, // WARN
  50: 17, // ERROR
  60: 21, // FATAL
};

// map SeverityNumber to text
export const PinoLevelToSeverityText = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
};
