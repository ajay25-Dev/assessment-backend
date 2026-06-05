import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Judge0CreateResponse = {
  token?: string;
  error?: string;
};

type Judge0Result = {
  token?: string;
  status?: { id?: number; description?: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
};

@Injectable()
export class Judge0Adapter {
  constructor(private readonly config: ConfigService) {}

  async submitAndWait(params: {
    languageId: number;
    sourceCode: string;
    stdin?: string;
    expectedOutput?: string;
    cpuTimeLimit?: number;
    memoryLimit?: number;
  }) {
    const baseUrl = this.getBaseUrl();
    const createResponse = await fetch(
      `${baseUrl}/submissions?base64_encoded=false&wait=false`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          language_id: params.languageId,
          source_code: params.sourceCode,
          stdin: params.stdin || '',
          expected_output: params.expectedOutput,
          cpu_time_limit:
            params.cpuTimeLimit ||
            Number(
              this.config.get<string>('JUDGE0_CPU_TIME_LIMIT_SECONDS') || 5,
            ),
          memory_limit:
            params.memoryLimit ||
            Number(this.config.get<string>('JUDGE0_MEMORY_LIMIT_KB') || 256000),
        }),
      },
    ).catch(() => {
      throw new InternalServerErrorException('Judge0 is unreachable');
    });

    const created = (await createResponse
      .json()
      .catch(() => null)) as Judge0CreateResponse | null;

    if (!createResponse.ok || !created?.token) {
      throw new InternalServerErrorException(
        created?.error || 'Judge0 submission failed',
      );
    }

    return this.poll(created.token);
  }

  private async poll(token: string): Promise<Judge0Result> {
    const baseUrl = this.getBaseUrl();
    const intervalMs = Number(
      this.config.get<string>('JUDGE0_POLL_INTERVAL_MS') || 1000,
    );
    const maxAttempts = Number(
      this.config.get<string>('JUDGE0_MAX_POLL_ATTEMPTS') || 45,
    );

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetch(
        `${baseUrl}/submissions/${token}?base64_encoded=false`,
        { headers: this.headers() },
      );
      const result = (await response
        .json()
        .catch(() => null)) as Judge0Result | null;

      if (!response.ok || !result) {
        throw new InternalServerErrorException('Judge0 result fetch failed');
      }

      const statusId = result.status?.id || 0;
      if (statusId > 2) return result;

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new InternalServerErrorException('Judge0 submission timed out');
  }

  private getBaseUrl() {
    const baseUrl = this.config.get<string>('JUDGE0_BASE_URL');
    if (!baseUrl) {
      throw new InternalServerErrorException(
        'JUDGE0_BASE_URL is not configured',
      );
    }

    return baseUrl.replace(/\/$/, '');
  }

  private headers() {
    const apiKey = this.config.get<string>('JUDGE0_API_KEY');
    return {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-Auth-Token': apiKey } : {}),
    };
  }
}
