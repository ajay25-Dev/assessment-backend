"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiClientService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let OpenAiClientService = class OpenAiClientService {
    config;
    constructor(config) {
        this.config = config;
    }
    get model() {
        return this.config.get('OPENAI_EVALUATION_MODEL') || 'gpt-4.1';
    }
    async generateStructuredJson(request) {
        const apiKey = this.config.get('OPENAI_API_KEY');
        if (!apiKey) {
            throw new common_1.InternalServerErrorException('OPENAI_API_KEY is not configured');
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
            temperature: Number(this.config.get('OPENAI_EVALUATION_TEMPERATURE') || 0),
        };
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
            .catch(() => null));
        if (!response.ok) {
            throw new common_1.InternalServerErrorException(payload?.error?.message ||
                `OpenAI request failed with status ${response.status}`);
        }
        const outputText = this.extractOutputText(payload);
        const parsed = this.parseJson(outputText);
        this.assertMatchesSchema(parsed, request.schema);
        return parsed;
    }
    extractOutputText(payload) {
        if (payload?.output_text)
            return payload.output_text;
        const text = payload?.output
            ?.flatMap((item) => item.content || [])
            .find((content) => content.type === 'output_text' && content.text)?.text;
        if (!text) {
            throw new common_1.InternalServerErrorException('OpenAI response did not include output text');
        }
        return text;
    }
    parseJson(value) {
        try {
            return JSON.parse(value);
        }
        catch {
            throw new common_1.InternalServerErrorException('OpenAI response was not valid JSON');
        }
    }
    assertMatchesSchema(value, schema, path = 'output') {
        if (schema.anyOf) {
            const matches = schema.anyOf.some((candidate) => {
                try {
                    this.assertMatchesSchema(value, candidate, path);
                    return true;
                }
                catch {
                    return false;
                }
            });
            if (!matches)
                throw new common_1.BadRequestException(`${path} did not match any allowed schema`);
            return;
        }
        if (schema.enum && !schema.enum.includes(String(value))) {
            throw new common_1.BadRequestException(`${path} must be one of: ${schema.enum.join(', ')}`);
        }
        if (!schema.type)
            return;
        if (schema.type === 'object') {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                throw new common_1.BadRequestException(`${path} must be an object`);
            }
            const record = value;
            const required = schema.required || [];
            required.forEach((key) => {
                if (!(key in record)) {
                    throw new common_1.BadRequestException(`${path}.${key} is required`);
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
                throw new common_1.BadRequestException(`${path} must be an array`);
            }
            value.forEach((item, index) => {
                this.assertMatchesSchema(item, schema.items || {}, `${path}[${index}]`);
            });
            return;
        }
        if (schema.type === 'string' && typeof value !== 'string') {
            throw new common_1.BadRequestException(`${path} must be a string`);
        }
        if (schema.type === 'integer' && !Number.isInteger(value)) {
            throw new common_1.BadRequestException(`${path} must be an integer`);
        }
        if (schema.type === 'number' && typeof value !== 'number') {
            throw new common_1.BadRequestException(`${path} must be a number`);
        }
        if (schema.type === 'boolean' && typeof value !== 'boolean') {
            throw new common_1.BadRequestException(`${path} must be a boolean`);
        }
    }
};
exports.OpenAiClientService = OpenAiClientService;
exports.OpenAiClientService = OpenAiClientService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenAiClientService);
//# sourceMappingURL=openai-client.service.js.map