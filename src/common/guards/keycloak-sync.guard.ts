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

    let localUser = await this.prisma.user.findUnique({
      where: { keycloakId: tokenUser.keycloakId },
    });

    if (!localUser) {
      localUser = await this.prisma.user.create({
        data: {
          keycloakId: tokenUser.keycloakId,
          email: tokenUser.email,
          username: tokenUser.username || tokenUser.email,
          role: tokenUser.role,
        },
      });
    } else if (
      localUser.email !== tokenUser.email ||
      localUser.role !== tokenUser.role
    ) {
      localUser = await this.prisma.user.update({
        where: { keycloakId: tokenUser.keycloakId },
        data: {
          email: tokenUser.email,
          role: tokenUser.role,
        },
      });
    }

    // Attach local user id so downstream code works the same for both auth types
    request.user = {
      ...tokenUser,
      id: localUser.id,
    };

    return true;
  }
}
