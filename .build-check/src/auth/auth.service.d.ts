import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
type SignupInput = {
    email?: string;
    password?: string;
    fullName?: string;
};
export declare class AuthService {
    private readonly config;
    private readonly mailService;
    constructor(config: ConfigService, mailService: MailService);
    signup(input: SignupInput): Promise<{
        ok: boolean;
        message: string;
    }>;
}
export {};
