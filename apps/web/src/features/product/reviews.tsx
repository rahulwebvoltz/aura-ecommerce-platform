import type { ReviewSummaryDto } from '@ecommerce/types';
import { reviewSchema, type ReviewInput } from '@ecommerce/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, MessageSquarePlus, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Rating, Reveal, Skeleton } from '@/components/ui/display';
import { Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/overlay';
import { errorMessage, queryKeys } from '@/lib/query';
import { cn, formatDate } from '@/lib/utils';
import { type ReviewFilters, reviewsApi } from '@/services/catalog.api';

function Distribution({ summary }: { summary: ReviewSummaryDto }) {
  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = summary.distribution[stars - 1] ?? 0;
        const share = summary.count === 0 ? 0 : count / summary.count;
        return (
          <div key={stars} className="flex items-center gap-3 text-sm">
            <span className="flex w-8 items-center gap-1 text-muted">
              {stars} <Star className="size-3" fill="currentColor" strokeWidth={0} />
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className="h-full rounded-full bg-warning"
                initial={{ width: 0 }}
                whileInView={{ width: `${String(share * 100)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: (5 - stars) * 0.08, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="w-8 text-right text-xs text-muted tabular-nums">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${String(star)} star${star === 1 ? '' : 's'}`}
          whileHover={{ scale: 1.2, rotate: -8 }}
          whileTap={{ scale: 0.85 }}
          onMouseEnter={() => {
            setHover(star);
          }}
          onMouseLeave={() => {
            setHover(0);
          }}
          onClick={() => {
            onChange(star);
          }}
          className={cn('transition-colors', star <= shown ? 'text-warning' : 'text-border')}
        >
          <Star className="size-9" fill="currentColor" strokeWidth={0} />
        </motion.button>
      ))}
    </div>
  );
}

// The API schema coerces `rating`; the form always holds a number, so it validates one directly.
const reviewFormSchema = reviewSchema.extend({
  rating: z.number().int().min(1, 'Choose a rating.').max(5),
});

function ReviewForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<ReviewInput>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: { rating: 0, title: '', comment: '' },
  });
  const mutation = useMutation({
    mutationFn: (input: ReviewInput) => reviewsApi.create(productId, input),
    onSuccess: async () => {
      toast.success('Thanks for your review!');
      await queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.reviewEligibility(productId) });
      await queryClient.invalidateQueries({ queryKey: ['product'] });
      onDone();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          mutation.mutate(values);
        })(event);
      }}
      className="space-y-5 p-6"
    >
      <div>
        <h2 className="text-display text-3xl">Write a review</h2>
        <p className="mt-1 text-sm text-muted">Your review is marked as a verified purchase.</p>
      </div>
      <Controller
        control={form.control}
        name="rating"
        render={({ field, fieldState }) => (
          <div className="space-y-1">
            <StarInput value={field.value} onChange={field.onChange} />
            {fieldState.error !== undefined && (
              <p className="text-sm text-sale">{fieldState.error.message}</p>
            )}
          </div>
        )}
      />
      <Input
        label="Title"
        placeholder="Sum it up in a few words"
        error={form.formState.errors.title?.message}
        {...form.register('title')}
      />
      <Textarea
        label="Review"
        placeholder="What did you like or dislike?"
        error={form.formState.errors.comment?.message}
        {...form.register('comment')}
      />
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Publish review
        </Button>
      </div>
    </form>
  );
}

export function ReviewsSection({
  productId,
  average,
  count,
}: {
  productId: string;
  average: number;
  count: number;
}) {
  const location = useLocation();
  const [filters, setFilters] = useState<ReviewFilters>({ page: 1, sort: 'newest' });
  const [writing, setWriting] = useState(false);
  const reviews = useQuery({
    queryKey: queryKeys.reviews(productId, filters),
    queryFn: () => reviewsApi.list(productId, filters),
  });
  const eligibility = useQuery({
    queryKey: queryKeys.reviewEligibility(productId),
    queryFn: () => reviewsApi.eligibility(productId),
  });

  const summary = reviews.data?.summary;
  const reason = eligibility.data?.reason;

  return (
    <section id="reviews" className="scroll-mt-28 border-t border-border py-20">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[340px_1fr]">
        <Reveal className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <h2 className="text-display text-5xl">Reviews</h2>
          <div className="flex items-end gap-4">
            <span className="text-display text-7xl leading-none">
              {(summary?.average ?? average).toFixed(1)}
            </span>
            <div className="pb-2">
              <Rating value={summary?.average ?? average} size={18} />
              <p className="mt-1 text-sm text-muted">{summary?.count ?? count} reviews</p>
            </div>
          </div>
          {summary !== undefined && <Distribution summary={summary} />}

          {eligibility.data?.canReview === true ? (
            <Button
              className="w-full"
              onClick={() => {
                setWriting(true);
              }}
            >
              <MessageSquarePlus className="size-4" /> Write a review
            </Button>
          ) : reason === 'NOT_AUTHENTICATED' ? (
            <p className="text-sm text-muted">
              <Link
                to="/login"
                state={{ from: location.pathname }}
                className="font-medium text-accent"
              >
                Sign in
              </Link>{' '}
              to review products you’ve bought.
            </p>
          ) : reason === 'NOT_PURCHASED' ? (
            <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">
              Reviews are open to customers once their order has been delivered.
            </p>
          ) : reason === 'ALREADY_REVIEWED' ? (
            <p className="flex items-center gap-2 rounded-2xl bg-success/10 p-4 text-sm text-success">
              <BadgeCheck className="size-4" /> Thanks - you’ve reviewed this product.
            </p>
          ) : null}
        </Reveal>

        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {(['newest', 'highest', 'lowest'] as const).map((sort) => (
              <button
                key={sort}
                type="button"
                onClick={() => {
                  setFilters((current) => ({ ...current, sort, page: 1 }));
                }}
                className={cn(
                  'relative rounded-full px-4 py-2 text-sm font-medium capitalize',
                  filters.sort === sort ? 'text-bg' : 'text-fg/70 hover:text-fg',
                )}
              >
                {filters.sort === sort && (
                  <motion.span
                    layoutId="review-sort"
                    className="absolute inset-0 rounded-full bg-fg"
                  />
                )}
                <span className="relative">{sort}</span>
              </button>
            ))}
            <select
              aria-label="Filter by rating"
              value={filters.rating ?? ''}
              onChange={(event) => {
                const value = event.target.value === '' ? undefined : Number(event.target.value);
                setFilters((current) => ({ ...current, rating: value, page: 1 }));
              }}
              className="ml-auto h-10 rounded-full border border-border bg-surface px-4 text-sm"
            >
              <option value="">All ratings</option>
              {[5, 4, 3, 2, 1].map((stars) => (
                <option key={stars} value={stars}>
                  {stars} stars
                </option>
              ))}
            </select>
          </div>

          {reviews.isPending ? (
            Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-32" />)
          ) : reviews.data === undefined || reviews.data.data.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">
              No reviews yet{filters.rating === undefined ? '' : ' with this rating'}.
            </p>
          ) : (
            <ul className="space-y-4">
              <AnimatePresence mode="popLayout">
                {reviews.data.data.map((review, index) => (
                  <motion.li
                    key={review.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-3xl border border-border bg-surface p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Rating value={review.rating} />
                      <span className="text-xs text-muted">{formatDate(review.createdAt)}</span>
                    </div>
                    <h3 className="mt-3 font-semibold">{review.title}</h3>
                    <p className="mt-1.5 leading-relaxed text-fg/80">{review.comment}</p>
                    <div className="mt-4 flex items-center gap-3 text-sm">
                      <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                        {review.author.name.charAt(0)}
                      </span>
                      <span className="font-medium">{review.author.name}</span>
                      {review.verifiedPurchase && (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <BadgeCheck className="size-3.5" /> Verified purchase
                        </span>
                      )}
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          {reviews.data !== undefined && reviews.data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => {
                  setFilters((current) => ({ ...current, page: (current.page ?? 1) - 1 }));
                }}
              >
                Newer
              </Button>
              <span className="text-sm text-muted">
                Page {reviews.data.meta.page} of {reviews.data.meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={reviews.data.meta.page >= reviews.data.meta.totalPages}
                onClick={() => {
                  setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }));
                }}
              >
                Older
              </Button>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={writing}
        onClose={() => {
          setWriting(false);
        }}
        title="Write a review"
      >
        <ReviewForm
          productId={productId}
          onDone={() => {
            setWriting(false);
          }}
        />
      </Modal>
    </section>
  );
}
