import { Module } from '@nestjs/common';
import {
  AssetController,
  AssetTypeController,
  LocationTypeController,
  SiteController,
  WorkLocationController,
} from './place.controller';
import { PlaceService } from './place.service';

@Module({
  controllers: [
    SiteController,
    LocationTypeController,
    WorkLocationController,
    AssetTypeController,
    AssetController,
  ],
  providers: [PlaceService],
  exports: [PlaceService],
})
export class PlaceModule {}
