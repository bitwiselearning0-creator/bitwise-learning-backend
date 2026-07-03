import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';

@Controller('api/v1/admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  async getUsers() {
    return this.adminService.getUsersList();
  }

  @Get('contents')
  async getContents() {
    return this.adminService.getContentsList();
  }

  @Delete('content/:id')
  @HttpCode(HttpStatus.OK)
  async deleteContent(@Param('id') id: string) {
    return this.adminService.deleteContent(id);
  }

  @Get('videos')
  async getVideos() {
    return this.adminService.getVideosList();
  }

  @Post('videos')
  async createVideo(
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('youtubeVideoId') youtubeVideoId: string,
    @Body('playlistName') playlistName: string,
    @Body('sequenceOrder') sequenceOrder: number,
    @Body('hlsUrl') hlsUrl: string,
    @Body('courseId') courseId?: string,
    @Body('semester') semester?: number,
    @Body('subjectId') subjectId?: string,
    @Body('unit') unit?: number,
  ) {
    return this.adminService.createVideo(
      title,
      description,
      youtubeVideoId,
      playlistName,
      sequenceOrder,
      hlsUrl,
      courseId,
      semester,
      subjectId,
      unit,
    );
  }

  @Delete('videos/:id')
  @HttpCode(HttpStatus.OK)
  async deleteVideo(@Param('id') id: string) {
    return this.adminService.deleteVideo(id);
  }

  @Post('content')
  async createContent(
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('type') type: 'note' | 'pyq' | 'trend_analysis' | 'pyq_solution',
    @Body('category') category: string,
    @Body('semester') semester: number,
    @Body('subject') subject: string,
    @Body('year') year: number,
    @Body('fileKey') fileKey: string,
    @Body('price') price: number,
    @Body('courseId') courseId?: string,
    @Body('subjectId') subjectId?: string,
  ) {
    return this.adminService.createContent(
      title,
      description,
      type,
      category,
      semester,
      subject,
      year || null,
      fileKey,
      price,
      courseId,
      subjectId,
    );
  }

  @Put('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  async banUser(@Param('id') userId: string, @Body('ban') isBanned: boolean) {
    return this.adminService.banUser(userId, isBanned);
  }

  @Post('users/:id/reset-device')
  @HttpCode(HttpStatus.OK)
  async resetDeviceBind(@Param('id') userId: string) {
    return this.adminService.resetDeviceBind(userId);
  }

  @Post('users/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetUserPassword(@Param('id') userId: string, @Body('newPassword') newPassword: string) {
    return this.adminService.resetUserPassword(userId, newPassword);
  }

  @Post('users/:id/role')
  @HttpCode(HttpStatus.OK)
  async changeUserRole(@Param('id') userId: string, @Body('role') role: string) {
    return this.adminService.changeUserRole(userId, role);
  }

  // Courses Administrative CRUD
  @Post('courses')
  async createCourse(
    @Body('name') name: string,
    @Body('badge') badge: string,
    @Body('isEnabled') isEnabled: boolean,
  ) {
    return this.adminService.createCourse(name, badge, isEnabled);
  }

  @Delete('courses/:id')
  @HttpCode(HttpStatus.OK)
  async deleteCourse(@Param('id') id: string) {
    return this.adminService.deleteCourse(id);
  }

  // Departments Administrative CRUD
  @Post('departments')
  async createDepartment(
    @Body('name') name: string,
    @Body('courseId') courseId: string,
  ) {
    return this.adminService.createDepartment(name, courseId);
  }

  @Delete('departments/:id')
  @HttpCode(HttpStatus.OK)
  async deleteDepartment(@Param('id') id: string) {
    return this.adminService.deleteDepartment(id);
  }

  // Academic Sessions Administrative CRUD
  @Post('academic_sessions')
  async createSession(
    @Body('name') name: string,
    @Body('isEnabled') isEnabled: boolean,
  ) {
    return this.adminService.createSession(name, isEnabled);
  }

  @Delete('academic_sessions/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSession(@Param('id') id: string) {
    return this.adminService.deleteSession(id);
  }

  // Subjects Administrative CRUD
  @Post('subjects')
  async createSubject(
    @Body('name') name: string,
    @Body('courseId') courseId: string,
    @Body('departmentId') departmentId: string,
    @Body('year') year: number,
    @Body('semester') semester: number,
  ) {
    return this.adminService.createSubject(name, courseId, departmentId, year, semester);
  }

  @Delete('subjects/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSubject(@Param('id') id: string) {
    return this.adminService.deleteSubject(id);
  }

  // Announcements Administrative CRUD
  @Post('announcements')
  async createAnnouncement(
    @Body('title') title: string,
    @Body('message') message: string,
  ) {
    return this.adminService.createAnnouncement(title, message);
  }

  @Delete('announcements/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAnnouncement(@Param('id') id: string) {
    return this.adminService.deleteAnnouncement(id);
  }

  // Study Bundles Administrative CRUD
  @Get('bundles')
  async getBundles() {
    return this.adminService.getBundles();
  }

  @Post('bundles')
  async createBundle(
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('price') price: number,
    @Body('courseId') courseId: string,
    @Body('semester') semester: number,
    @Body('contentIds') contentIds: string[],
  ) {
    return this.adminService.createBundle(title, description, price, courseId, semester, contentIds);
  }

  @Delete('bundles/:id')
  @HttpCode(HttpStatus.OK)
  async deleteBundle(@Param('id') id: string) {
    return this.adminService.deleteBundle(id);
  }

  @Put('bundles/:id/archive')
  @HttpCode(HttpStatus.OK)
  async archiveBundle(@Param('id') id: string) {
    return this.adminService.archiveBundle(id, true);
  }

  @Put('bundles/:id/restore')
  @HttpCode(HttpStatus.OK)
  async restoreBundle(@Param('id') id: string) {
    return this.adminService.archiveBundle(id, false);
  }

  @Get('toppers-pass')
  async getToppersPass() {
    return this.adminService.getToppersPassContentIds();
  }

  @Post('toppers-pass')
  @HttpCode(HttpStatus.OK)
  async updateToppersPass(@Body('contentIds') contentIds: string[]) {
    return this.adminService.updateToppersPassContentIds(contentIds);
  }
}
