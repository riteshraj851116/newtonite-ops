import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';

describe('Frontend Badge Components', () => {
  it('renders StatusBadge with proper status class and text', () => {
    const { rerender } = render(<StatusBadge status="Open" />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Open')).toHaveClass('badge-status-open');

    rerender(<StatusBadge status="In_Progress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toHaveClass('badge-status-in-progress');

    rerender(<StatusBadge status="Awaiting_Approval" />);
    expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Approval')).toHaveClass('badge-status-awaiting');

    rerender(<StatusBadge status="Resolved" />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toHaveClass('badge-status-resolved');

    rerender(<StatusBadge status="Closed" />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toHaveClass('badge-status-closed');
  });

  it('renders PriorityBadge with corresponding styling', () => {
    const { rerender } = render(<PriorityBadge priority="Urgent" />);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toHaveClass('badge-priority-urgent');

    rerender(<PriorityBadge priority="High" />);
    expect(screen.getByText('High')).toHaveClass('badge-priority-high');

    rerender(<PriorityBadge priority="Medium" />);
    expect(screen.getByText('Medium')).toHaveClass('badge-priority-medium');

    rerender(<PriorityBadge priority="Low" />);
    expect(screen.getByText('Low')).toHaveClass('badge-priority-low');
  });
});
