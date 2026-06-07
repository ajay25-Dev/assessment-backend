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
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer_1 = __importDefault(require("nodemailer"));
let MailService = class MailService {
    config;
    constructor(config) {
        this.config = config;
    }
    async sendVerificationEmail(input) {
        const host = this.config.get('EMAIL_SERVER_HOST');
        const port = Number(this.config.get('EMAIL_SERVER_PORT') || 587);
        const user = this.config.get('EMAIL_SERVER_USER');
        const pass = this.config.get('EMAIL_SERVER_PASSWORD');
        const secure = String(this.config.get('EMAIL_SERVER_SECURE') || 'false') ===
            'true';
        const from = this.config.get('EMAIL_FROM') || 'JoraIQ <no-reply@joraiq.ai>';
        if (!host || !user || !pass) {
            throw new common_1.InternalServerErrorException('SMTP settings are not configured');
        }
        const transporter = nodemailer_1.default.createTransport({
            host,
            port,
            secure,
            auth: {
                user,
                pass,
            },
        });
        const displayName = input.fullName?.trim() || 'there';
        await transporter.sendMail({
            from,
            to: input.to,
            subject: 'Confirm your JoraIQ email address',
            text: [
                `Hi ${displayName},`,
                '',
                'Confirm your email address to finish creating your JoraIQ account.',
                '',
                input.verificationUrl,
                '',
                'If you did not request this account, you can ignore this email.',
            ].join('\n'),
            html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h1 style="font-size:22px;margin:0 0 16px">Confirm your JoraIQ email address</h1>
          <p>Hi ${this.escapeHtml(displayName)},</p>
          <p>Confirm your email address to finish creating your JoraIQ account.</p>
          <p>
            <a href="${input.verificationUrl}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">
              Confirm email address
            </a>
          </p>
          <p style="font-size:13px;color:#64748b">If the button does not work, paste this link into your browser:</p>
          <p style="font-size:13px;word-break:break-all;color:#334155">${input.verificationUrl}</p>
        </div>
      `,
        });
    }
    escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map