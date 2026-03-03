export type InputBinding = {
  placeholder: string;
  column: string;
};

export type ExtractRule = {
  key: string;
  path: string;
  mode?: "text" | "json";
};

export type DoneRule =
  | { type: "sentinel_text"; value: string }
  | { type: "json_path_equals"; path: string; equals: string | number | boolean }
  | { type: "event_name"; value: string }
  | { type: "connection_close" }
  | { type: "max_idle_ms"; value: number };

export type DoneStrategy = "auto" | "manual";
export type StreamProtocol = "auto" | "sse" | "ndjson" | "plain_text";
