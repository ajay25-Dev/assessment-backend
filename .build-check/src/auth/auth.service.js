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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_js_1 = require("@supabase/supabase-js");
const ws_1 = __importDefault(require("ws"));
const mail_service_1 = require("./mail.service");
let AuthService = class AuthService {
    config;
    mailService;
    constructor(config, mailService) {
        this.config = config;
        this.mailService = mailService;
    }
    async signup(input) {
        const email = String(input.email || '')
            .trim()
            .toLowerCase();
        const password = String(input.password || '');
        const fullName = String(input.fullName || '').trim();
        if (!email || !email.includes('@')) {
            throw new common_1.BadRequestException('A valid email is required');
        }
        if (password.length < 6) {
            throw new common_1.BadRequestException('Password must be at least 6 characters');
        }
        const supabaseUrl = this.config.get('SUPABASE_URL');
        const serviceRoleKey = this.config.get('SUPABASE_SERVICE_ROLE') ||
            this.config.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !serviceRoleKey) {
            throw new common_1.InternalServerErrorException('Supabase admin credentials are not configured');
        }
        const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
        const redirectTo = `${frontendUrl.replace(/\/$/, '')}/auth/callback?next=/dashboard`;
        const supabase = (0, supabase_js_1.createClient)(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
            realtime: {
                transport: ws_1.default,
            },
        });
        const { data, error } = await supabase.auth.admin.generateLink({
            type: 'signup',
            email,
            password,
            options: {
                redirectTo,
                data: {
                    full_name: fullName || null,
                },
            },
        });
        if (error) {
            throw new common_1.BadRequestException(error.message);
        }
        if (data.user?.id) {
            const { error: profileError } = await supabase.from('profiles').upsert({
                id: data.user.id,
                email,
                full_name: fullName || null,
                role: 'student',
            });
            if (profileError) {
                throw new common_1.InternalServerErrorException(`Account created, but profile could not be saved: ${profileError.message}`);
            }
        }
        const actionLink = data.properties?.action_link;
        if (!actionLink) {
            throw new common_1.InternalServerErrorException('Supabase did not return a verification link');
        }
        await this.mailService.sendVerificationEmail({
            to: email,
            verificationUrl: actionLink,
            fullName,
        });
        return {
            ok: true,
            message: 'Account created. Please verify your email.',
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        mail_service_1.MailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map