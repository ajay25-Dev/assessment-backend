import { AuthService } from './auth.service';
type SignupBody = {
    email?: string;
    password?: string;
    fullName?: string;
};
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    signup(body: SignupBody): Promise<{
        ok: boolean;
        message: string;
    }>;
}
export {};
