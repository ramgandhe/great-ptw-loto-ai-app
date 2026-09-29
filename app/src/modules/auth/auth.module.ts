import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { SignInService } from './sign-in.service';
import { KeycloakAdminModule } from '../../infrastructure/keycloak/keycloak-admin.module';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), KeycloakAdminModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SignInService],
  exports: [AuthService],
})
export class AuthModule {}
