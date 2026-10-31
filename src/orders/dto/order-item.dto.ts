import { IsNumber, IsPositive, IsString, MaxLength } from 'class-validator';

export class OrderItemDto {
  @IsString()
  @MaxLength(255)
  description: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;
}
