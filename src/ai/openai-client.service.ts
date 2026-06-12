import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonObject, JsonSchema, StructuredJsonRequest } from './ai.types';

type OpenAiResponseItem = {
  type?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type OpenAiResponsesApiResponse = {
  output_text?: string;
  output?: OpenAiResponseItem[];
  error?: {
    message?: string;
  };
};

@Injectable()
export class OpenAiClientService {
  private readonly logger = new Logger(OpenAiClientService.name);

  constructor(private readonly config: ConfigService) {}

  get model() {
    return this.config.get<string>('OPENAI_EVALUATION_MODEL') || 'gpt-5.4-mini';
  }

  async generateStructuredJson(request: StructuredJsonRequest) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      throw new InternalServerErrorException(
        'OPENAI_API_KEY is not configured',
      );
    }

    const body = {
      model: this.model,
      input: [
        {
          role: 'system',
          content: request.systemPrompt,
        },
        {
          role: 'user',
          content: JSON.stringify(request.input),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: request.schemaName,
          strict: true,
          schema: request.schema,
        },
      },
      temperature: Number(
        this.config.get<string>('OPENAI_EVALUATION_TEMPERATURE') || 0,
      ),
    };

    this.logger.log(
      `OpenAI structured request: schema=${request.schemaName}, input_keys=${Object.keys(request.input).join(',')}, input_preview=${JSON.stringify(request.input).slice(0, 500)}`,
    );

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = (await response
      .json()
      .catch(() => null)) as OpenAiResponsesApiResponse | null;

    if (!response.ok) {
      throw new InternalServerErrorException(
        payload?.error?.message ||
          `OpenAI request failed with status ${response.status}`,
      );
    }

    const outputText = this.extractOutputText(payload);
    this.logger.log(`OpenAI structured response text: ${outputText.slice(0, 500)}`);
    const parsed = this.parseJson(outputText);
    this.assertMatchesSchema(parsed, request.schema);

    return parsed;
  }

  private extractOutputText(payload: OpenAiResponsesApiResponse | null) {
    if (payload?.output_text) return payload.output_text;

    const text = payload?.output
      ?.flatMap((item) => item.content || [])
      .find((content) => content.type === 'output_text' && content.text)?.text;

    if (!text) {
      throw new InternalServerErrorException(
        'OpenAI response did not include output text',
      );
    }

    return text;
  }

  private parseJson(value: string) {
    try {
      return JSON.parse(value) as JsonObject;
    } catch {
      throw new InternalServerErrorException(
        'OpenAI response was not valid JSON',
      );
    }
  }

  private assertMatchesSchema(
    value: unknown,
    schema: JsonSchema,
    path = 'output',
  ) {
    if (schema.anyOf) {
      const matches = schema.anyOf.some((candidate) => {
        try {
          this.assertMatchesSchema(value, candidate, path);
          return true;
        } catch {
          return false;
        }
      });
      if (!matches)
        throw new BadRequestException(
          `${path} did not match any allowed schema`,
        );
      return;
    }

    if (schema.enum && !schema.enum.map(String).includes(String(value))) {
      throw new BadRequestException(
        `${path} must be one of: ${schema.enum.join(', ')}`,
      );
    }

    if (!schema.type) return;

    if (schema.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new BadRequestException(`${path} must be an object`);
      }

      const record = value as Record<string, unknown>;
      const required = schema.required || [];

      required.forEach((key) => {
        if (!(key in record)) {
          throw new BadRequestException(`${path}.${key} is required`);
        }
      });

      Object.entries(schema.properties || {}).forEach(([key, childSchema]) => {
        if (key in record) {
          this.assertMatchesSchema(record[key], childSchema, `${path}.${key}`);
        }
      });

      return;
    }

    if (schema.type === 'array') {
      if (!Array.isArray(value)) {
        throw new BadRequestException(`${path} must be an array`);
      }

      value.forEach((item, index) => {
        this.assertMatchesSchema(item, schema.items || {}, `${path}[${index}]`);
      });
      return;
    }

    if (schema.type === 'string' && typeof value !== 'string') {
      throw new BadRequestException(`${path} must be a string`);
    }

    if (schema.type === 'integer' && !Number.isInteger(value)) {
      throw new BadRequestException(`${path} must be an integer`);
    }

    if (schema.type === 'number' && typeof value !== 'number') {
      throw new BadRequestException(`${path} must be a number`);
    }

    if (schema.type === 'boolean' && typeof value !== 'boolean') {
      throw new BadRequestException(`${path} must be a boolean`);
    }
  }
}
