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
exports.Judge0Adapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let Judge0Adapter = class Judge0Adapter {
    config;
    constructor(config) {
        this.config = config;
    }
    async submitAndWait(params) {
        const baseUrl = this.getBaseUrl();
        const createResponse = await fetch(`${baseUrl}/submissions?base64_encoded=true&wait=false`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({
                language_id: params.languageId,
                source_code: this.encodeBase64(params.sourceCode),
                stdin: this.encodeBase64(params.stdin || ''),
                expected_output: params.expectedOutput
                    ? this.encodeBase64(params.expectedOutput)
                    : undefined,
                cpu_time_limit: params.cpuTimeLimit ||
                    Number(this.config.get('JUDGE0_CPU_TIME_LIMIT_SECONDS') || 5),
                memory_limit: params.memoryLimit ||
                    Number(this.config.get('JUDGE0_MEMORY_LIMIT_KB') || 256000),
            }),
        }).catch(() => {
            throw new common_1.InternalServerErrorException('Judge0 is unreachable');
        });
        const created = (await createResponse
            .json()
            .catch(() => null));
        if (!createResponse.ok || !created?.token) {
            throw new common_1.InternalServerErrorException(created?.error || 'Judge0 submission failed');
        }
        return this.poll(created.token);
    }
    async poll(token) {
        const baseUrl = this.getBaseUrl();
        const intervalMs = Number(this.config.get('JUDGE0_POLL_INTERVAL_MS') || 1000);
        const maxAttempts = Number(this.config.get('JUDGE0_MAX_POLL_ATTEMPTS') || 45);
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const response = await fetch(`${baseUrl}/submissions/${token}?base64_encoded=true`, { headers: this.headers() });
            const result = (await response
                .json()
                .catch(() => null));
            if (!response.ok || !result) {
                throw new common_1.InternalServerErrorException('Judge0 result fetch failed');
            }
            const statusId = result.status?.id || 0;
            if (statusId > 2)
                return this.decodeResult(result);
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
        throw new common_1.InternalServerErrorException('Judge0 submission timed out');
    }
    getBaseUrl() {
        const baseUrl = this.config.get('JUDGE0_BASE_URL');
        if (!baseUrl) {
            throw new common_1.InternalServerErrorException('JUDGE0_BASE_URL is not configured');
        }
        return baseUrl.replace(/\/$/, '');
    }
    headers() {
        const apiKey = this.config.get('JUDGE0_API_KEY');
        return {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'X-Auth-Token': apiKey } : {}),
        };
    }
    encodeBase64(value) {
        return Buffer.from(value, 'utf8').toString('base64');
    }
    decodeBase64(value) {
        if (!value)
            return value;
        try {
            return Buffer.from(value, 'base64').toString('utf8');
        }
        catch {
            return value;
        }
    }
    decodeResult(result) {
        return {
            ...result,
            stdout: this.decodeBase64(result.stdout),
            stderr: this.decodeBase64(result.stderr),
            compile_output: this.decodeBase64(result.compile_output),
            message: this.decodeBase64(result.message),
        };
    }
};
exports.Judge0Adapter = Judge0Adapter;
exports.Judge0Adapter = Judge0Adapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], Judge0Adapter);
//# sourceMappingURL=judge0.adapter.js.map