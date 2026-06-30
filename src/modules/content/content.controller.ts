import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { DeviceGuard } from '../../common/guards/device.guard';
import { ContentService } from './content.service';
import { Request, Response } from 'express';

@Controller('api/v1/content')
@UseGuards(AuthGuard, DeviceGuard)
export class ContentController {
  constructor(private contentService: ContentService) {}

  @Get()
  async getCatalog(
    @Req() req: Request,
    @Query('type') type?: 'note' | 'pyq',
    @Query('category') category?: string,
    @Query('semester') semester?: string,
    @Query('subject') subject?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = req['user'];
    const sem = semester ? parseInt(semester, 10) : undefined;
    const lim = limit ? parseInt(limit, 10) : 10;
    const off = offset ? parseInt(offset, 10) : 0;
    return this.contentService.getCatalog(user.id, user.role, type, category, sem, subject, lim, off);
  }

  @Get('bundles')
  async getBundles(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const lim = limit ? parseInt(limit, 10) : 10;
    const off = offset ? parseInt(offset, 10) : 0;
    return this.contentService.getBundles(lim, off);
  }

  @Get(':id')
  async getContentDetails(@Req() req: Request, @Param('id') id: string) {
    const user = req['user'];
    return this.contentService.getContentDetails(user.id, id, user.role);
  }

  @Get(':id/stream')
  async streamPdf(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const user = req['user'];
    const stream = await this.contentService.getFileStream(user.id, id, user.role);
    
    // Set headers to block downloading/caching and force PDF inline streaming
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    stream.pipe(res);
  }
}
