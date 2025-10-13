import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK, NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-node';
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
    [ATTR_SERVICE_NAME]: 'yourServiceName',
    [ATTR_SERVICE_VERSION]: '1.0',
  });

  // Configure the trace exporter based on the environment
  // In production, send traces to Jaeger/SigNoz via OTLP.
  // In development, print traces to the console for easy debugging.
  const traceExporter =
    process.env.NODE_ENV === 'production'
      ? new OTLPTraceExporter({
          url: 'http://localhost:4317', // Your Jaeger/Collector OTLP gRPC receiver
        })
      : new ConsoleSpanExporter();

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

  // Gracefully shut down the SDK on process exit
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .finally(() => process.exit(0))
      .catch((err) => {
        console.error('Error shutting down OpenTelemetry SDK:', err);
        process.exit(1);
      });
  });

  sdk.start();
  console.log('OpenTelemetry Tracing started');
}
