export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource was not found.') {
    super(message, 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized.') {
    super(message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden.') {
    super(message, 403)
  }
}
