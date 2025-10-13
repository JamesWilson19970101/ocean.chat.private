import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK, NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

/**
 * Initializes and starts the OpenTelemetry SDK.
 *
 * This function should be called once, at the very beginning of the application's lifecycle.
 * It sets up the resource, span processors, exporters, and instrumentations.
 */
export function startTracing() {
  // Define the resource for your service
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'oceanchat-auth',
    [ATTR_SERVICE_VERSION]: '1.0',
  });

  // Configure the trace exporter based on the environment
  // Always send traces to an OTLP-compatible receiver (like Jaeger).
  // The URL can be configured via the OTEL_EXPORTER_OTLP_TRACES_ENDPOINT environment variable.
  const traceExporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4317',
  });

  // Use BatchSpanProcessor for production for better performance
  const spanProcessor = new BatchSpanProcessor(traceExporter);

  // Configure the metric reader (exposes metrics to Prometheus)
  const metricReader = new PrometheusExporter({
    port: 9464, // Default port for Prometheus scraping
    endpoint: '/metrics',
  });

  const sdkConfig: Partial<NodeSDKConfiguration> = {
    resource,
    spanProcessor,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Optionally disable some instrumentations to reduce noise
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  };

  const sdk = new NodeSDK(sdkConfig);

  // A separate, explicitly typed function to handle shutdown logic.
  // This helps to avoid ESLint's type inference issues within the process.on callback.
  const shutdownHandler = (sdkToShutdown: NodeSDK) => {
    sdkToShutdown
      .shutdown()
      .catch((err) => {
        console.error('Error shutting down OpenTelemetry SDK:', err);
        process.exit(1);
      })
      .finally(() => process.exit(0));
  };

  process.on('SIGTERM', () => shutdownHandler(sdk));
  process.on('SIGINT', () => shutdownHandler(sdk));

  sdk.start();
  console.log('OpenTelemetry Tracing started');
}
