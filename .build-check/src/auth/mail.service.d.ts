import { ConfigService } from '@nestjs/config';
type VerificationEmailInput = {
    to: string;
    verificationUrl: string;
    fullName?: string;
};
export declare class MailService {
    private readonly config;
    constructor(config: ConfigService);
    sendVerificationEmail(input: VerificationEmailInput): Promise<void>;
    private escapeHtml;
}
export {};
