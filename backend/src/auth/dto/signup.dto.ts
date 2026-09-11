import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Name must not be empty' })
  name!: string;
}
