import {
  authSessionSchema,
  authTokensSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@vireo/shared";
import { createZodDto } from "nestjs-zod";

// Cienkie opakowania schematów z @vireo/shared. Klasa jest potrzebna, bo
// Nest (pipe'y, a w etapie 4b Swagger) odczytuje typ parametru z metadanych
// dekoratorów — a te istnieją tylko dla klas, nie dla obiektów Zod.

export class RegisterDto extends createZodDto(registerSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}

export class AuthSessionDto extends createZodDto(authSessionSchema) {}
export class AuthTokensDto extends createZodDto(authTokensSchema) {}
