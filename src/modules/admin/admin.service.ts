import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { R2Service } from '../../common/services/r2.service';
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private db: DatabaseService,
    private r2Service: R2Service,
  ) {}

  async getUsersList() {
    const res = await this.db.query(
      'SELECT id, email, full_name, role, status, device_id FROM users ORDER BY created_at DESC'
    );
    return res.rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      status: row.status,
      deviceId: row.device_id,
    }));
  }

  async getDashboardStats() {
    // Total Users
    const usersCount = await this.db.query('SELECT COUNT(*) FROM users');
    // Active Subscriptions
    const subCount = await this.db.query('SELECT COUNT(*) FROM subscriptions WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP');
    // Total Revenue
    const revenue = await this.db.query("SELECT SUM(amount) FROM purchases WHERE status = 'completed'");
    // Content distribution
    const contentDistribution = await this.db.query('SELECT type, COUNT(*) FROM contents GROUP BY type');

    return {
      totalUsers: parseInt(usersCount.rows[0].count, 10),
      activeSubscriptions: parseInt(subCount.rows[0].count, 10),
      totalRevenue: parseFloat(revenue.rows[0].sum || '0.00'),
      contents: contentDistribution.rows.reduce((acc, row) => {
        acc[row.type] = parseInt(row.count, 10);
        return acc;
      }, {}),
    };
  }

  async createContent(
    title: string,
    description: string,
    type: 'note' | 'pyq' | 'trend_analysis' | 'pyq_solution',
    category: string,
    semester: number,
    subject: string,
    year: number | null,
    fileKey: string,
    price: number,
    courseId?: string,
    subjectId?: string,
  ) {
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const key = `notes/${uniqueId}_${Date.now()}.pdf`;

    let base64Clean = fileKey;
    if (fileKey.includes('base64,')) {
      base64Clean = fileKey.split('base64,')[1];
    }

    let uploadedToR2 = false;
    if (this.r2Service.isConfigured()) {
      try {
        await this.r2Service.uploadFile(key, base64Clean);
        uploadedToR2 = true;
      } catch (err) {
        this.logger.error(`R2 upload failed: ${err.message}. Falling back to local storage.`);
      }
    }

    if (!uploadedToR2) {
      const localDir = path.resolve(__dirname, '../../../../storage');
      const filePath = path.join(localDir, key);
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(filePath, Buffer.from(base64Clean, 'base64'));
      this.logger.log(`Successfully saved local file: Path=${filePath}`);
    }

    const queryText = `
      INSERT INTO contents (title, description, type, category, semester, subject, year, file_key, price, course_id, subject_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const res = await this.db.query(queryText, [
      title,
      description,
      type,
      category,
      semester,
      subject,
      year,
      key,
      price,
      courseId || null,
      subjectId || null,
    ]);
    return res.rows[0];
  }

  async banUser(userId: string, isBanned: boolean) {
    const status = isBanned ? 'banned' : 'active';
    await this.db.query('UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      status,
      userId,
    ]);
    return { success: true, status };
  }

  async resetDeviceBind(userId: string) {
    await this.db.query('UPDATE users SET device_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [
      userId,
    ]);
    return { success: true, message: 'Device binding reset successful' };
  }

  async resetUserPassword(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      passwordHash,
      userId,
    ]);
    return { success: true, message: 'Password reset successful' };
  }

  async getContentsList() {
    const res = await this.db.query(
      'SELECT id, title, description, type, category, semester, subject, year, price FROM contents ORDER BY created_at DESC'
    );
    return res.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      category: row.category,
      semester: row.semester,
      subject: row.subject,
      year: row.year,
      price: parseFloat(row.price),
    }));
  }

  async deleteContent(id: string) {
    const res = await this.db.query('SELECT file_key FROM contents WHERE id = $1', [id]);
    if (res.rows.length > 0) {
      const fileKey = res.rows[0].file_key;
      if (this.r2Service.isConfigured()) {
        try {
          await this.r2Service.deleteFile(fileKey);
        } catch (e) {
          this.logger.error(`Failed to delete file from R2: Key=${fileKey}`, e.stack);
        }
      }
      
      const localDir = path.resolve(__dirname, '../../../../storage');
      const filePath = path.join(localDir, fileKey);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          this.logger.error(`Failed to delete local file: Path=${filePath}`, e.stack);
        }
      }
    }

    await this.db.query('DELETE FROM contents WHERE id = $1', [id]);
    return { success: true, message: 'Content deleted successfully' };
  }

  async getVideosList() {
    const res = await this.db.query(
      'SELECT id, title, description, youtube_video_id, playlist_name, sequence_order, hls_url, course_id AS "courseId", semester, subject_id AS "subjectId", unit FROM videos ORDER BY playlist_name, sequence_order ASC'
    );
    return res.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      youtubeVideoId: row.youtube_video_id,
      playlistName: row.playlist_name,
      sequenceOrder: row.sequence_order,
      hlsUrl: row.hls_url,
      courseId: row.courseId,
      semester: row.semester,
      subjectId: row.subjectId,
      unit: row.unit,
    }));
  }

  async createVideo(
    title: string,
    description: string,
    youtubeVideoId: string,
    playlistName: string,
    sequenceOrder: number,
    hlsUrl: string,
    courseId?: string,
    semester?: number,
    subjectId?: string,
    unit?: number,
  ) {
    const res = await this.db.query(
      `INSERT INTO videos (title, description, youtube_video_id, playlist_name, sequence_order, hls_url, course_id, semester, subject_id, unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [title, description, youtubeVideoId, playlistName, sequenceOrder, hlsUrl, courseId || null, semester || null, subjectId || null, unit || null]
    );
    return res.rows[0];
  }

  async deleteVideo(id: string) {
    await this.db.query('DELETE FROM videos WHERE id = $1', [id]);
    return { success: true, message: 'Video deleted successfully' };
  }

  // Administrative Metadata CRUD Methods
  async createCourse(name: string, badge: string, isEnabled: boolean) {
    const id = 'c_' + Math.random().toString(36).substring(2, 9);
    const res = await this.db.query(
      'INSERT INTO courses (id, name, badge, is_enabled) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, badge || null, isEnabled]
    );
    return {
      id: res.rows[0].id,
      name: res.rows[0].name,
      badge: res.rows[0].badge,
      isEnabled: res.rows[0].is_enabled,
    };
  }

  async deleteCourse(id: string) {
    await this.db.query('DELETE FROM courses WHERE id = $1', [id]);
    return { success: true };
  }

  async createDepartment(name: string, courseId: string) {
    const id = 'd_' + Math.random().toString(36).substring(2, 9);
    const res = await this.db.query(
      'INSERT INTO departments (id, name, course_id) VALUES ($1, $2, $3) RETURNING *',
      [id, name, courseId]
    );
    return {
      id: res.rows[0].id,
      name: res.rows[0].name,
      courseId: res.rows[0].course_id,
    };
  }

  async deleteDepartment(id: string) {
    await this.db.query('DELETE FROM departments WHERE id = $1', [id]);
    return { success: true };
  }

  async createSession(name: string, isEnabled: boolean) {
    const id = 's_' + name.replace(/[^a-zA-Z0-9]/g, '_');
    const res = await this.db.query(
      'INSERT INTO academic_sessions (id, name, is_enabled) VALUES ($1, $2, $3) RETURNING *',
      [id, name, isEnabled]
    );
    return {
      id: res.rows[0].id,
      name: res.rows[0].name,
      isEnabled: res.rows[0].is_enabled,
    };
  }

  async deleteSession(id: string) {
    await this.db.query('DELETE FROM academic_sessions WHERE id = $1', [id]);
    return { success: true };
  }

  async createSubject(name: string, courseId: string, departmentId: string, year: number, semester: number) {
    const id = 'sub_' + Math.random().toString(36).substring(2, 9);
    const res = await this.db.query(
      'INSERT INTO subjects (id, name, course_id, department_id, year, semester) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, name, courseId, departmentId, year, semester]
    );
    return {
      id: res.rows[0].id,
      name: res.rows[0].name,
      courseId: res.rows[0].course_id,
      deptId: res.rows[0].department_id,
      year: res.rows[0].year,
      semester: res.rows[0].semester,
    };
  }

  async deleteSubject(id: string) {
    await this.db.query('DELETE FROM subjects WHERE id = $1', [id]);
    return { success: true };
  }

  async createAnnouncement(title: string, message: string) {
    const id = 'ann_' + Math.random().toString(36).substring(2, 9);
    const res = await this.db.query(
      'INSERT INTO announcements (id, title, message) VALUES ($1, $2, $3) RETURNING *',
      [id, title, message]
    );
    return {
      id: res.rows[0].id,
      title: res.rows[0].title,
      message: res.rows[0].message,
      createdAt: res.rows[0].created_at,
    };
  }

  async deleteAnnouncement(id: string) {
    await this.db.query('DELETE FROM announcements WHERE id = $1', [id]);
    return { success: true };
  }

  // Administrative Bundle CRUD Methods
  async getBundles() {
    const res = await this.db.query('SELECT * FROM bundles ORDER BY created_at DESC');
    const bundles = [];
    for (const row of res.rows) {
      const contentRes = await this.db.query(
        'SELECT content_id FROM bundle_contents WHERE bundle_id = $1',
        [row.id]
      );
      bundles.push({
        id: row.id,
        title: row.title,
        description: row.description,
        price: parseFloat(row.price),
        courseId: row.course_id,
        semester: row.semester,
        isArchived: row.is_archived,
        isAvailable: row.is_available,
        createdAt: row.created_at,
        contentIds: contentRes.rows.map((r) => r.content_id),
      });
    }
    return bundles;
  }

  async createBundle(
    title: string,
    description: string,
    price: number,
    courseId: string,
    semester: number,
    contentIds: string[],
  ) {
    return this.db.transaction(async (client) => {
      const bundleRes = await client.query(
        `INSERT INTO bundles (title, description, price, course_id, semester, is_archived, is_available)
         VALUES ($1, $2, $3, $4, $5, FALSE, TRUE)
         RETURNING *`,
        [title, description, price, courseId, semester]
      );
      const bundle = bundleRes.rows[0];

      if (contentIds && contentIds.length > 0) {
        for (const contentId of contentIds) {
          await client.query(
            'INSERT INTO bundle_contents (bundle_id, content_id) VALUES ($1, $2)',
            [bundle.id, contentId]
          );
        }
      }

      return {
        id: bundle.id,
        title: bundle.title,
        description: bundle.description,
        price: parseFloat(bundle.price),
        courseId: bundle.course_id,
        semester: bundle.semester,
        isArchived: bundle.is_archived,
        isAvailable: bundle.is_available,
        createdAt: bundle.created_at,
        contentIds,
      };
    });
  }

  async deleteBundle(id: string) {
    await this.db.query('DELETE FROM bundles WHERE id = $1', [id]);
    return { success: true, message: 'Bundle deleted successfully' };
  }

  async archiveBundle(id: string, archive: boolean) {
    await this.db.query('UPDATE bundles SET is_archived = $1 WHERE id = $2', [archive, id]);
    return { success: true, message: `Bundle ${archive ? 'archived' : 'restored'} successfully` };
  }

  async getToppersPassContentIds() {
    const res = await this.db.query(
      "SELECT content_id AS \"contentId\" FROM bundle_contents WHERE bundle_id = '00000000-0000-0000-0000-000000000000'"
    );
    return res.rows.map((row) => row.contentId);
  }

  async updateToppersPassContentIds(contentIds: string[]) {
    return this.db.transaction(async (client) => {
      // 1. Ensure bundle exists
      await client.query(`
        INSERT INTO bundles (id, title, description, price, course_id, semester, is_archived, is_available)
        VALUES ('00000000-0000-0000-0000-000000000000', 'Toppers'' Royal Pass', 'All premium study notes, PYQ solutions and secure videos bundle.', 499.00, NULL, NULL, FALSE, TRUE)
        ON CONFLICT (id) DO NOTHING
      `);

      // 2. Clear old mappings
      await client.query("DELETE FROM bundle_contents WHERE bundle_id = '00000000-0000-0000-0000-000000000000'");

      // 3. Map new contents
      if (contentIds && contentIds.length > 0) {
        for (const contentId of contentIds) {
          await client.query(
            "INSERT INTO bundle_contents (bundle_id, content_id) VALUES ('00000000-0000-0000-0000-000000000000', $1)",
            [contentId]
          );
        }
      }
      return { success: true };
    });
  }
}
