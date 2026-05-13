// Every Iris tool response must conform to this shape.
// data_class drives the citation label shown in the UI.

export type DataClass = 1 | 2 | 3;

export type ToolResponse<T = unknown> = {
  data: T;
  data_class: DataClass;
  source: string;
  timestamp: string; // ISO 8601
};

export function toolResponse<T>(
  data: T,
  opts: { data_class: DataClass; source: string }
): ToolResponse<T> {
  return {
    data,
    data_class: opts.data_class,
    source: opts.source,
    timestamp: new Date().toISOString(),
  };
}
