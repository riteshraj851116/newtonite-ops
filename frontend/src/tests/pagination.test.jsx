import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Pagination from '../components/Pagination';

describe('Pagination Component', () => {
  it('renders page info and fires onPageChange', () => {
    const handlePageChange = vi.fn();

    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        totalItems={45}
        limit={10}
        onPageChange={handlePageChange}
      />
    );

    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: /Previous page/i });
    expect(prevBtn).toBeDisabled();

    const nextBtn = screen.getByRole('button', { name: /Next page/i });
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });
});
