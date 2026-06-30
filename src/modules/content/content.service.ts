import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { R2Service } from '../../common/services/r2.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private db: DatabaseService,
    private r2Service: R2Service,
  ) {}

  async getCatalog(
    type?: 'note' | 'pyq',
    category?: string,
    semester?: number,
    subject?: string,
    limit = 10,
    offset = 0,
  ) {
    let queryText = 'SELECT * FROM contents WHERE is_available = TRUE';
    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      queryText += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (category) {
      queryText += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (semester) {
      queryText += ` AND semester = $${paramIndex}`;
      params.push(semester);
      paramIndex++;
    }

    if (subject) {
      queryText += ` AND subject ILIKE $${paramIndex}`;
      params.push(`%${subject}%`);
      paramIndex++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const res = await this.db.query(queryText, params);
    return res.rows;
  }

  async getBundles(limit = 10, offset = 0) {
    const res = await this.db.query(
      'SELECT * FROM bundles WHERE is_available = TRUE AND is_archived = FALSE ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    const bundles = [];
    for (const bundle of res.rows) {
      const contentsRes = await this.db.query(
        `SELECT c.id, c.title, c.type, c.subject, c.price 
         FROM contents c
         JOIN bundle_contents bc ON bc.content_id = c.id
         WHERE bc.bundle_id = $1 AND c.is_available = TRUE`,
        [bundle.id]
      );
      bundles.push({
        id: bundle.id,
        title: bundle.title,
        description: bundle.description,
        price: parseFloat(bundle.price),
        courseId: bundle.course_id,
        semester: bundle.semester,
        isArchived: bundle.is_archived,
        isAvailable: bundle.is_available,
        createdAt: bundle.created_at,
        contentIds: contentsRes.rows.map((r) => r.id),
        items: contentsRes.rows.map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          subject: r.subject,
          price: parseFloat(r.price),
        })),
      });
    }

    return bundles;
  }

  async checkAccess(userId: string, itemId: string, role: string): Promise<boolean> {
    if (role === 'admin') {
      return true;
    }

    // Check if user has an active direct subscription or bundle subscription
    const queryText = `
      SELECT EXISTS (
        SELECT 1 FROM subscriptions
        WHERE user_id = $1
          AND (
            item_id = $2 
            OR item_id IN (
              SELECT bundle_id FROM bundle_contents WHERE content_id = $2
            )
          )
          AND expires_at > CURRENT_TIMESTAMP
          AND is_active = TRUE
      );
    `;

    const res = await this.db.query(queryText, [userId, itemId]);
    return res.rows[0].exists;
  }

  async getContentDetails(userId: string, itemId: string, role: string) {
    const contentRes = await this.db.query('SELECT * FROM contents WHERE id = $1', [itemId]);
    if (contentRes.rows.length === 0) {
      throw new NotFoundException('Content not found');
    }

    const content = contentRes.rows[0];
    const hasAccess = await this.checkAccess(userId, itemId, role);

    return {
      id: content.id,
      title: content.title,
      description: content.description,
      type: content.type,
      category: content.category,
      semester: content.semester,
      subject: content.subject,
      year: content.year,
      price: content.price,
      hasAccess,
    };
  }

  async getFileStream(userId: string, itemId: string, role: string) {
    const hasAccess = await this.checkAccess(userId, itemId, role);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied. Please purchase this content or bundle.');
    }

    const contentRes = await this.db.query('SELECT file_key FROM contents WHERE id = $1', [itemId]);
    if (contentRes.rows.length === 0) {
      throw new NotFoundException('Content not found');
    }

    const fileKey = contentRes.rows[0].file_key;

    if (this.r2Service.isConfigured()) {
      return this.r2Service.getFileStream(fileKey);
    }

    const localDir = path.resolve(__dirname, '../../../../storage');
    const filePath = path.join(localDir, fileKey);

    if (!fs.existsSync(filePath)) {
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(filePath, `%PDF-1.4 mock pdf contents for resource ${itemId}`);
    }

    return fs.createReadStream(filePath);
  }
}
