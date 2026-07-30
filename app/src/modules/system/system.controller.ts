import { Controller, Get } from '@nestjs/common';
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
