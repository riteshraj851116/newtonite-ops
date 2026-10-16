import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ currentPage, totalPages, totalItems, limit, onPageChange }) => {
  if (totalPages <= 1 && totalItems <= limit) return null;

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Showing{' '}
        <span className="font-semibold">
          {totalItems === 0 ? 0 : (currentPage - 1) * limit + 1}
        </span>{' '}
        to{' '}
        <span className="font-semibold">
          {Math.min(currentPage * limit, totalItems)}
        </span>{' '}
        of <span className="font-semibold">{totalItems}</span> items
      </div>

      <div className="pagination-controls">
        <button
          className="btn-pagination"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <span className="pagination-current-page">
          Page {currentPage} of {totalPages || 1}
        </span>

        <button
          className="btn-pagination"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
