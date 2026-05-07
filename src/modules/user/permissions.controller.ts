import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';

const PERMISSIONS = [
  'roles.read',
  'roles.write',
  'users.role.assign',
];

@ApiTags('Permission')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Danh sách quyền (Admin only)' })
  listPermissions() {
    return PERMISSIONS;
  }
}
