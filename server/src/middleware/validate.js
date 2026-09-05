import { AppError } from './errors.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const msg = result.error.issues[0]?.message || 'Invalid input.';
      throw new AppError(400, msg);
    }
    req[source] = result.data;
    next();
  };
}