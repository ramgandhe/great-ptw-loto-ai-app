import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_PRIORITIES,
} from '../../../database/schema/notifications';

export class ListNotificationsQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;
}

export class CreateTestNotificationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @IsOptional()
  @IsIn([...NOTIFICATION_CHANNELS])
  channel?: (typeof NOTIFICATION_CHANNELS)[number];
}

export class CreateReminderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsUUID()
  recipientUserId!: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  dedupeKey?: string;
}

export class CreateEscalationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsUUID()
  recipientUserId!: string;

  @IsOptional()
  @IsIn([...NOTIFICATION_PRIORITIES])
  priority?: (typeof NOTIFICATION_PRIORITIES)[number];

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  dedupeKey?: string;
}

export class GenerateNotificationDto {
  @IsIn([...NOTIFICATION_EVENT_TYPES])
  eventType!: (typeof NOTIFICATION_EVENT_TYPES)[number];

  @IsIn([...NOTIFICATION_CATEGORIES])
  category!: (typeof NOTIFICATION_CATEGORIES)[number];

  @IsOptional()
  @IsIn([...NOTIFICATION_PRIORITIES])
  priority?: (typeof NOTIFICATION_PRIORITIES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  recipientUserIds!: string[];

  @IsOptional()
  @IsIn([...NOTIFICATION_CHANNELS])
  channel?: (typeof NOTIFICATION_CHANNELS)[number];

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  dedupeKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceModule?: string;
}
