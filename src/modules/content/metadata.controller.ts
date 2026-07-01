import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { DatabaseService } from '../../database/database.service';

@Controller('api/v1')
@UseGuards(AuthGuard)
export class MetadataController {
  constructor(private db: DatabaseService) {}

  @Get('courses')
  async getCourses() {
    const res = await this.db.query(
      'SELECT id, name, badge, is_enabled AS "isEnabled" FROM courses ORDER BY name ASC'
    );
    return res.rows;
  }

  @Get('departments')
  async getDepartments() {
    const res = await this.db.query(
      'SELECT id, name, course_id AS "courseId" FROM departments ORDER BY name ASC'
    );
    return res.rows;
  }

  @Get('academic_sessions')
  async getSessions() {
    const res = await this.db.query(
      'SELECT id, name, is_enabled AS "isEnabled" FROM academic_sessions ORDER BY name DESC'
    );
    return res.rows;
  }

  @Get('subjects')
  async getSubjects() {
    const res = await this.db.query(
      'SELECT id, name, course_id AS "courseId", department_id AS "deptId", year, semester FROM subjects ORDER BY name ASC'
    );
    return res.rows;
  }

  @Get('announcements')
  async getAnnouncements() {
    const res = await this.db.query(
      'SELECT id, title, message, created_at AS "createdAt" FROM announcements ORDER BY created_at DESC'
    );
    if (res.rows.length === 0) {
      return [
        {
          id: 'default_welcome_announcement',
          title: 'Welcome to Bitwise Learning!',
          message: 'Explore your course modules, lecture notes, and video classes to boost your computer science preparation.',
          createdAt: new Date().toISOString(),
        }
      ];
    }
    return res.rows;
  }
}
