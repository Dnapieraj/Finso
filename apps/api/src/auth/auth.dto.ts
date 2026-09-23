import {
  authSessionSchema,
  authTokensSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from '@vireo/shared';
import { createZodDto } from 'nestjs-zod';

// Cienkie opakowania schematów z @vireo/shared. Klasa jest potrzebna, bo
// Nest (pipe'y, a w etapie 4b Swagger) odczytuje typ parametru z metadanych
// dekoratorów — a te istnieją tylko dla klas, nie dla obiektów Zod.

export class RegisterDto extends createZodDto(registerSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}

export class AuthSessionDto extends createZodDto(authSessionSchema) {}
export class AuthTokensDto extends createZodDto(authTokensSchema) {}
