import { Body, Controller, Post, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ---------------------------------------------------------------------------
  // Local JWT Auth
  // ---------------------------------------------------------------------------

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with local credentials' })
  @ApiResponse({ status: 200, description: 'Returns access & refresh tokens' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new local account' })
  @ApiResponse({ status: 201, description: 'Returns new user info' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Returns new access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (revoke refresh token)' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  logout(@Body() dto: RefreshTokenDto, @CurrentUser() user: any) {
    return this.authService.logout(dto.refreshToken, user.id);
  }

  // ---------------------------------------------------------------------------
  // Keycloak Auth
  // ---------------------------------------------------------------------------

  @Public()
  @Post('keycloak/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login via Keycloak (proxy)' })
  @ApiResponse({ status: 200, description: 'Returns Keycloak tokens' })
  keycloakLogin(@Body() dto: LoginDto) {
    return this.authService.loginViaKeycloak(dto.email, dto.password);
  }

  @Post('keycloak/logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from Keycloak' })
  @ApiResponse({ status: 200, description: 'Keycloak logout successful' })
  keycloakLogout(@Body() dto: RefreshTokenDto) {
    return this.authService.logoutFromKeycloak(dto.refreshToken);
  }

  // ---------------------------------------------------------------------------
  // Shared
  // ---------------------------------------------------------------------------

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns user profile' })
  getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.id, user.keycloakId);
  }
}
