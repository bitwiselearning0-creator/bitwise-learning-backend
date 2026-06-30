import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as crypto from 'crypto';

@Injectable()
export class VideosService {
  constructor(private db: DatabaseService) {}

  async getVideos(playlistName?: string, limit = 10, offset = 0) {
    let queryText = 'SELECT * FROM videos';
    const params: any[] = [];
    let paramIndex = 1;

    if (playlistName) {
      queryText += ` WHERE playlist_name = $${paramIndex}`;
      params.push(playlistName);
      paramIndex++;
    }

    queryText += ` ORDER BY playlist_name, sequence_order LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const res = await this.db.query(queryText, params);
    return res.rows;
  }

  async getPlaylists() {
    const res = await this.db.query(
      'SELECT DISTINCT playlist_name FROM videos WHERE playlist_name IS NOT NULL'
    );
    return res.rows.map((row) => row.playlist_name);
  }

  async getHlsKey(userId: string, videoId: string): Promise<Buffer> {
    // 1. Verify user status
    const userRes = await this.db.query('SELECT status FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || userRes.rows[0].status === 'banned') {
      throw new ForbiddenException('User is inactive or banned');
    }

    // 2. Verify video exists
    const videoRes = await this.db.query('SELECT id FROM videos WHERE id = $1', [videoId]);
    if (videoRes.rows.length === 0) {
      throw new NotFoundException('Video not found');
    }

    // 3. Compute deterministic AES-128 key using HMAC-SHA-256 of videoId
    const secret = process.env.API_ENCRYPTION_KEY || 'default_secret_32_bytes_long_key_!';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(videoId);
    return hmac.digest().slice(0, 16); // 16 bytes for AES-128
  }

  async updateProgress(userId: string, videoId: string, progressSeconds: number) {
    // Check if video exists
    const videoRes = await this.db.query('SELECT id FROM videos WHERE id = $1', [videoId]);
    if (videoRes.rows.length === 0) {
      throw new NotFoundException('Video not found');
    }

    // Upsert watch progress
    const queryText = `
      INSERT INTO watch_progress (user_id, video_id, progress_seconds, last_watched_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, video_id)
      DO UPDATE SET progress_seconds = EXCLUDED.progress_seconds, last_watched_at = CURRENT_TIMESTAMP;
    `;

    await this.db.query(queryText, [userId, videoId, progressSeconds]);
    return { success: true };
  }

  async getUserProgressList(userId: string) {
    const queryText = `
      SELECT wp.progress_seconds, wp.last_watched_at, v.id as video_id, v.title, v.youtube_video_id, v.playlist_name
      FROM watch_progress wp
      JOIN videos v ON v.id = wp.video_id
      WHERE wp.user_id = $1
      ORDER BY wp.last_watched_at DESC
      LIMIT 10;
    `;
    const res = await this.db.query(queryText, [userId]);
    return res.rows;
  }

  async getDoubts(videoId: string) {
    const res = await this.db.query(
      `SELECT dm.id, dm.message, dm.is_instructor, dm.created_at, u.full_name as user_name 
       FROM doubt_messages dm
       JOIN users u ON u.id = dm.user_id
       WHERE dm.video_id = $1
       ORDER BY dm.created_at ASC`,
      [videoId]
    );
    return res.rows.map((row) => ({
      id: row.id,
      message: row.message,
      isInstructor: row.is_instructor,
      createdAt: row.created_at,
      userName: row.is_instructor ? 'Instructor (Manoj)' : row.user_name,
    }));
  }

  async createDoubt(userId: string, videoId: string, message: string) {
    // 1. Verify video exists
    const videoRes = await this.db.query('SELECT id FROM videos WHERE id = $1', [videoId]);
    if (videoRes.rows.length === 0) {
      throw new NotFoundException('Video not found');
    }

    // 2. Insert message
    const res = await this.db.query(
      `INSERT INTO doubt_messages (video_id, user_id, message, is_instructor)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id, message, is_instructor as "isInstructor", created_at as "createdAt"`,
      [videoId, userId, message]
    );
    
    // Fetch user details for response
    const userRes = await this.db.query('SELECT full_name FROM users WHERE id = $1', [userId]);
    const userName = userRes.rows[0]?.full_name || 'Student';

    return {
      ...res.rows[0],
      userName,
    };
  }
}
