import { ConfigService } from '@nestjs/config';
import { JsonObject, StructuredJsonRequest } from './ai.types';
export declare class OpenAiClientService {
    private readonly config;
    constructor(config: ConfigService);
    get model(): string;
    generateStructuredJson(request: StructuredJsonRequest): Promise<JsonObject>;
    private extractOutputText;
    private parseJson;
    private assertMatchesSchema;
}
