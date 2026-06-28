import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateAdminUserDto, ResetAdminUserPasswordDto, UpdateAdminUserDto } from './dto/admin-user.dto';
import { AdminService } from './admin.service';

type AdminRequestUser = { id: string; email: string };

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    return this.adminService.listUsers(page, pageSize);
  }

  @Post('users')
  createUser(@CurrentUser() user: AdminRequestUser, @Body() dto: CreateAdminUserDto) {
    return this.adminService.createUser(user, dto);
  }

  @Patch('users/:id')
  updateUser(@CurrentUser() user: AdminRequestUser, @Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.adminService.updateUser(user, id, dto);
  }

  @Post('users/:id/reset-password')
  resetPassword(@CurrentUser() user: AdminRequestUser, @Param('id') id: string, @Body() dto: ResetAdminUserPasswordDto) {
    return this.adminService.resetPassword(user, id, dto);
  }

  @Patch('users/:id/active')
  setActiveState(@CurrentUser() user: AdminRequestUser, @Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.adminService.setActiveState(user, id, Boolean(isActive));
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() user: AdminRequestUser, @Param('id') id: string) {
    return this.adminService.deleteUser(user, id);
  }

  @Get('logs')
  listLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    return this.adminService.listLogs(page, pageSize);
  }
}
