import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Put } from '@nestjs/common';
import { UserService } from './user.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserPageDto } from './dto/user-page.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('User')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin profile người dùng hiện tại' })
  getMe(@CurrentUser() user: any) {
    return this.userService.getProfile(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Cập nhật profile người dùng hiện tại' })
  updateMe(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(user.id, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Danh sách người dùng (Admin only)' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'active | inactive | true | false | 1 | 0' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'field:asc|desc (e.g. createdAt:desc)' })
  findAll(
    @Query('search') search?: string,
    @Query('role') role?: Role,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
  ) {
    return this.userService.findAll({
      search,
      role,
      status,
      page: page ? +page : 1,
      limit: limit ? +limit : 10,
      sort,
    });
  }

  @Post('page')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Danh sách người dùng theo định dạng phân trang FE' })
  findPage(@Body() dto: UserPageDto) {
    return this.userService.findPage(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cập nhật người dùng (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Xóa người dùng (Admin only)' })
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
