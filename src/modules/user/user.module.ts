import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';
import { UsersAdminController } from './users-admin.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController, UsersAdminController, RolesController, PermissionsController],
  providers: [UserService]
})
export class UserModule {}
