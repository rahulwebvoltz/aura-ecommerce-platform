import type { User } from '@ecommerce/db';
import type { UserDto } from '@ecommerce/types';

/** Public user shape. Never includes the password hash. */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  };
}
