import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProductCard } from '@/features/catalog/product-card';
import { createTestQueryClient, product, wrapperFor } from '@/test/utils';

import { Button } from './button';
import { EmptyState, Price, QuantityStepper, Rating } from './display';
import { Input } from './field';
import { Pagination } from './pagination';

describe('display components', () => {
  it('shows savings only when there is a real discount', () => {
    const { rerender } = render(<Price price={80_000} compareAtPrice={100_000} />);
    expect(screen.getByText('₹800')).toBeInTheDocument();
    expect(screen.getByText('₹1,000')).toBeInTheDocument();
    expect(screen.getByText('20% off')).toBeInTheDocument();

    rerender(<Price price={80_000} compareAtPrice={null} />);
    expect(screen.queryByText(/off/u)).not.toBeInTheDocument();
  });

  it('labels ratings for assistive technology', () => {
    render(<Rating value={4.25} count={12} />);
    expect(screen.getByRole('img', { name: 'Rated 4.3 out of 5' })).toBeInTheDocument();
    expect(screen.getByText('(12)')).toBeInTheDocument();
  });

  it('keeps quantity within bounds', async () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={1} max={2} onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('renders empty states with an action', () => {
    render(
      <EmptyState
        icon={<span />}
        title="Nothing here"
        description="Add something."
        action={<Button>Go</Button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });
});

describe('form controls', () => {
  it('links labels and errors to inputs', () => {
    render(<Input label="Email" error="Enter a valid email address." />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
  });

  it('disables buttons while loading', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('pagination', () => {
  it('collapses distant pages and marks the current one', async () => {
    const onChange = vi.fn();
    render(<Pagination page={5} totalPages={10} onChange={onChange} />);

    expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByText('…')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('product card', () => {
  it('shows price, discount, stock, and adds to a guest bag', async () => {
    const client = createTestQueryClient();
    render(<ProductCard product={product} />, { wrapper: wrapperFor(client) });

    for (const link of screen.getAllByRole('link', { name: 'Phone' })) {
      expect(link).toHaveAttribute('href', '/products/phone');
    }
    expect(screen.getByText('−16%')).toBeInTheDocument();
    expect(screen.getByText('Only 4 left')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add Phone to bag' }));
    expect(await screen.findByText('Quick add')).toBeInTheDocument();
  });
});
