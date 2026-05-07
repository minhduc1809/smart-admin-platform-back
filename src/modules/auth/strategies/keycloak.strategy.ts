import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
  constructor() {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'smart-admin';
    const issuerUrl = `${keycloakUrl}/realms/${realm}`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${issuerUrl}/protocol/openid-connect/certs`,
      }),
      issuer: issuerUrl,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    const realmRoles: string[] = payload.realm_access?.roles || [];
    const role =
      ['ADMIN', 'MANAGER', 'USER'].find((r) => realmRoles.includes(r)) ||
      'USER';

    return {
      keycloakId: payload.sub,
      email: payload.email,
      username: payload.preferred_username,
      role,
    };
  }
}
