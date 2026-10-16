import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConflictModal from '../components/ConflictModal';

describe('ConflictModal Component (Critical Requirement)', () => {
  it('renders conflict message, revision comparison, and handles reload', () => {
    const handleReload = vi.fn();
    const handleClose = vi.fn();

    const mockConflictData = {
      conflictType: 'STALE_UPDATE',
      message: 'Conflict: This work item was modified by another user.',
      submittedVersion: 1,
      currentVersion: 2,
      currentWorkItem: {
        title: 'Server Updated Title',
        status: 'In Progress',
        priority: 'High',
        assignedTo: { name: 'Sarah Chen' },
      },
    };

    render(
      <ConflictModal
        isOpen={true}
        conflictData={mockConflictData}
        onResolveReload={handleReload}
        onClose={handleClose}
      />
    );

    // Verify title and alert message
    expect(screen.getByText('Concurrency Conflict Detected')).toBeInTheDocument();
    expect(screen.getByText(/Conflict: This work item was modified/i)).toBeInTheDocument();

    // Verify revision comparison
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('Server Updated Title')).toBeInTheDocument();

    // Click reconcile button
    const reconcileBtn = screen.getByRole('button', { name: /Reconcile & Load Latest Data/i });
    fireEvent.click(reconcileBtn);

    expect(handleReload).toHaveBeenCalledTimes(1);
  });
});
