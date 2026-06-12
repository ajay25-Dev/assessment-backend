export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  enum?: Array<string | number | boolean>;
  anyOf?: JsonSchema[];
  description?: string;
};

export type StructuredJsonRequest = {
  schemaName: string;
  schema: JsonSchema;
  systemPrompt: string;
  input: JsonObject;
};
