import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const createWorkItemSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(150, 'Title cannot exceed 150 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  type: z.enum(['Incident', 'Customer_Issue', 'Payment', 'Compliance', 'Task']).default('Task'),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  teamId: z.string().uuid('Please specify a valid team ID'),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional().or(z.date().nullable().optional()),
});

export const updateWorkItemSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  description: z.string().min(5).optional(),
  type: z.enum(['Incident', 'Customer_Issue', 'Payment', 'Compliance', 'Task']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional().or(z.date().nullable().optional()),
  version: z.number().int({ message: 'Version integer is required for optimistic locking' }),
});

export const transitionSchema = z.object({
  status: z.enum(['Open', 'In_Progress', 'Awaiting_Approval', 'Resolved', 'Closed']),
  version: z.number().int({ message: 'Current version integer is required' }),
  note: z.string().max(1000).optional(),
});

export const commentSchema = z.object({
  content: z.string().min(1, 'Comment text cannot be empty').max(2000, 'Comment cannot exceed 2000 characters'),
});
