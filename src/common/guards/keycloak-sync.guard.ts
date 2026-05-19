import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class KeycloakSyncGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const tokenUser = request.user;

    // Only run sync for Keycloak tokens (they have keycloakId, not id)
    if (!tokenUser?.keycloakId) return true;

    let dbUser = await this.prisma.user.findFirst({
      where: { keycloakId: tokenUser.keycloakId },
    });

    if (!dbUser) {
      dbUser = await this.prisma.user.create({
        data: {
          keycloakId: tokenUser.keycloakId,
          email: tokenUser.email,
          username: tokenUser.preferred_username,
          role: 'USER',
        } as any,
      });
    } else {
      // Sync fields
      if (dbUser.email !== tokenUser.email || dbUser.username !== tokenUser.preferred_username) {
        dbUser = await this.prisma.user.update({
          where: { id: dbUser.id },
          data: {
            email: tokenUser.email,
            username: tokenUser.preferred_username,
          },
        });
      }
    }

    // Attach local user id so downstream code works the same for both auth types
    request.user = {
      ...tokenUser,
      id: dbUser.id,
    };

    return true;
  }
}
