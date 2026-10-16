export const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);
  }

  // Prisma Unique Constraint violation
  if (err.code === 'P2002') {
    const target = err.meta?.target ? err.meta.target.join(', ') : 'field';
    return res.status(409).json({
      success: false,
      message: `Conflict: Unique constraint failed on ${target}.`,
      conflictType: 'UNIQUE_CONSTRAINT',
    });
  }

  // Prisma Record Not Found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'The requested database record was not found.',
    });
  }

  // Zod Validation Error (fallback)
  if (err.name === 'ZodError') {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors,
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(err.conflictType && { conflictType: err.conflictType }),
    ...(err.currentVersion !== undefined && { currentVersion: err.currentVersion }),
    ...(err.submittedVersion !== undefined && { submittedVersion: err.submittedVersion }),
    ...(err.currentAssignee && { currentAssignee: err.currentAssignee }),
    ...(err.currentItem && { currentItem: err.currentItem }),
  });
};
