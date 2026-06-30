import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Param,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { DeviceGuard } from '../../common/guards/device.guard';
import { VideosService } from './videos.service';
import { Request, Response } from 'express';

@Controller('api/v1/videos')
@UseGuards(AuthGuard, DeviceGuard)
export class VideosController {
  constructor(private videosService: VideosService) {}

  @Get()
  async getVideos(
    @Query('playlist') playlist?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 10;
    const off = offset ? parseInt(offset, 10) : 0;
    return this.videosService.getVideos(playlist, lim, off);
  }

  @Get('playlists')
  async getPlaylists() {
    return this.videosService.getPlaylists();
  }

  @Get('progress')
  async getUserProgressList(@Req() req: Request) {
    const user = req['user'];
    return this.videosService.getUserProgressList(user.id);
  }

  @Post('progress')
  @HttpCode(HttpStatus.OK)
  async updateProgress(
    @Req() req: Request,
    @Body('videoId') videoId: string,
    @Body('progressSeconds') progressSeconds: number,
  ) {
    const user = req['user'];
    return this.videosService.updateProgress(user.id, videoId, progressSeconds);
  }

  @Get('hls-key/:videoId')
  async getHlsKey(
    @Req() req: Request,
    @Param('videoId') videoId: string,
    @Res() res: Response,
  ) {
    const user = req['user'];
    const key = await this.videosService.getHlsKey(user.id, videoId);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', key.length);
    res.end(key);
  }

  @Get(':videoId/doubts')
  async getDoubts(@Param('videoId') videoId: string) {
    return this.videosService.getDoubts(videoId);
  }

  @Post(':videoId/doubts')
  @HttpCode(HttpStatus.OK)
  async createDoubt(
    @Req() req: Request,
    @Param('videoId') videoId: string,
    @Body('message') message: string,
  ) {
    const user = req['user'];
    return this.videosService.createDoubt(user.id, videoId, message);
  }
}
