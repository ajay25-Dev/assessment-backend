import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { MailService } from './mail.service';

type SignupInput = {
  email?: string;
  password?: string;
  fullName?: string;
  rollNumber?: string;
  roll_number?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async signup(input: SignupInput) {
    const email = String(input.email || '')
      .trim()
      .toLowerCase();
    const password = String(input.password || '');
    const fullName = String(input.fullName || '').trim();
    const rollNumber = String(input.rollNumber || input.roll_number || '').trim();

    if (!email || !email.includes('@')) {
      throw new BadRequestException('A valid email is required');
    }

    if (password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey =
      this.config.get<string>('SUPABASE_SERVICE_ROLE') ||
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new InternalServerErrorException(
        'Supabase admin credentials are not configured',
      );
    }

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const redirectTo = `${frontendUrl.replace(/\/$/, '')}/auth/callback?next=/dashboard`;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: WebSocket as never,
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
          roll_number: rollNumber || null,
        },
      },
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (data.user?.id) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName || null,
        roll_number: rollNumber || null,
        role: 'student',
      });

      if (profileError) {
        throw new InternalServerErrorException(
          `Account created, but profile could not be saved: ${profileError.message}`,
        );
      }
    }

    const actionLink = data.properties?.action_link;
    if (!actionLink) {
      throw new InternalServerErrorException(
        'Supabase did not return a verification link',
      );
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
}
