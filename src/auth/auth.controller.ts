import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 req/min
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // Protection Test
  @Get('me')
  me(@Req() req: { user: { id: string; email: string } }) {
    return req.user;
  }
}
