interface CompletedResponse {
  status: 'completed';
  body: any;
  statusCode: number;
}

interface ProcessingResponse {
  status: 'processing';
}

export type CachedResponse = ProcessingResponse | CompletedResponse;
