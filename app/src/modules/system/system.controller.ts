import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../../common/decorators/auth.decorators';
import { HealthService } from './system.service';
import { SystemService } from './system.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  check() {
    return this.healthService.check();
  }

  /** Kubernetes/compose liveness probe — process up only. */
  @Public()
  @Get('live')
  live() {
    return this.healthService.live();
  }

  /** Kubernetes/compose readiness probe — critical deps must be up. */
  @Public()
  @Get('ready')
  async ready() {
    const result = await this.healthService.ready();
    if (result.status !== 'ready') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Public()
  @Get('config')
  getConfig() {
    return this.systemService.getConfig();
  }

  @Public()
  @Get('version')
  getVersion() {
    return this.systemService.getVersion();
  }
}
