import type { IngestAdapter } from '../pipeline';

export type HttpJsonAdapterOptions = {
  source: string;
  label: string;
  endpoint: string;
  headers?: Record<string, string>;
  /**
   * Pulls the record array out of the operator's envelope. Defaults to the
   * response itself being the array.
   */
  select?: (payload: unknown) => unknown[];
  fetchImpl?: typeof fetch;
};

const defaultSelect = (payload: unknown): unknown[] => (Array.isArray(payload) ? payload : []);

/**
 * Adapter for operators that publish a JSON endpoint.
 *
 * HTML-scraping operators get their own adapters; they only need to implement
 * `fetchRecords` and emit the same raw record shape.
 */
export function createHttpJsonAdapter(options: HttpJsonAdapterOptions): IngestAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const select = options.select ?? defaultSelect;

  return {
    source: options.source,
    label: options.label,
    async fetchRecords() {
      const response = await fetchImpl(options.endpoint, {
        headers: { accept: 'application/json', ...options.headers },
      });

      if (!response.ok) {
        throw new Error(`${options.source}: HTTP ${response.status}`);
      }

      return select(await response.json());
    },
  };
}
