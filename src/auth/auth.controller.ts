import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

type SignupBody = {
  email?: string;
  password?: string;
  fullName?: string;
  rollNumber?: string;
  roll_number?: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(201)
  signup(@Body() body: SignupBody) {
    return this.authService.signup(body);
  }
}
