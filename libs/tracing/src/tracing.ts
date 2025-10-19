import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { MongooseInstrumentation } from '@opentelemetry/instrumentation-mongoose';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK, NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

const VERSION = '1.0.0';

/**
 * Initializes and starts the OpenTelemetry SDK.
 *
 * This function should be called once, at the very beginning of the application's lifecycle.
 * It sets up the resource, span processors, exporters, and instrumentations.
 */
export function startTracing(serviceName: string, serviceInstanceId: string) {
  // Define the resource for your service
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: `${serviceName}-${serviceInstanceId}`,
    [ATTR_SERVICE_VERSION]: VERSION,
  });

  const collectorOptions = {
    // url is optional and can be omitted - default is http://localhost:4317
    url:
      process.env.OTEL_EXPORTER_OTLP_GRPC_ENDPOINT || 'http://localhost:4317',
  };
  // Configure the trace exporter based on the environment
  // Always send traces to an OTLP-compatible receiver (like Jaeger).
  // The URL can be configured via the OTEL_EXPORTER_OTLP_TRACES_ENDPOINT environment variable.
  const traceExporter = new OTLPTraceExporter(collectorOptions); // default is http://localhost:4317

  // Configure the OTLP metric exporter to push metrics to the collector.
  const metricExporter = new OTLPMetricExporter(collectorOptions); // default is http://localhost:4317
  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 10000, // Export metrics every 10 seconds. Adjust as needed.
  });

  const sdkConfig: Partial<NodeSDKConfiguration> = {
    resource,
    spanProcessor: new BatchSpanProcessor(traceExporter),
    metricReader,
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new GrpcInstrumentation(),
      new IORedisInstrumentation(),
      new MongooseInstrumentation(),
      new PinoInstrumentation(),
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
