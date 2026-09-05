import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global JwtAuthGuard. Only the handful of endpoints
 * that cannot carry an Authorization header (the login itself, and the image
 * URLs the browser puts straight into <img src>) are allowed to use it.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
