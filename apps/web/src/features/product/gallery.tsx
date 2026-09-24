import type { ProductImageDto } from '@ecommerce/types';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { forwardRef, useState } from 'react';

import { cn } from '@/lib/utils';

export const ProductGallery = forwardRef<
  HTMLDivElement,
  { images: ProductImageDto[]; name: string }
>(function ProductGallery({ images, name }, ref) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const current = images[index];

  const go = (next: number) => {
    if (images.length === 0) {
      return;
    }
    setDirection(next > index ? 1 : -1);
    setIndex((next + images.length) % images.length);
  };

  const onDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (info.offset.x < -60) go(index + 1);
    else if (info.offset.x > 60) go(index - 1);
  };

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row">
      {images.length > 1 && (
        <div
          className="no-scrollbar flex gap-3 overflow-x-auto lg:flex-col"
          role="tablist"
          aria-label="Product images"
        >
          {images.map((image, imageIndex) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              aria-selected={imageIndex === index}
              aria-label={`Show image ${String(imageIndex + 1)}`}
              onClick={() => {
                go(imageIndex);
              }}
              className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-surface-2"
            >
              <img
                src={image.url}
                alt=""
                className="size-full object-contain p-2 mix-blend-multiply dark:mix-blend-normal"
              />
              {imageIndex === index && (
                <motion.span
                  layoutId="gallery-thumb"
                  className="absolute inset-0 rounded-2xl ring-2 ring-fg ring-inset"
                  transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      <div
        ref={ref}
        className="relative aspect-square flex-1 cursor-zoom-in overflow-hidden rounded-[32px] bg-surface-2"
        onPointerMove={(event) => {
          if (event.pointerType !== 'mouse') {
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          setZoom({
            x: ((event.clientX - rect.left) / rect.width) * 100,
            y: ((event.clientY - rect.top) / rect.height) * 100,
          });
        }}
        onPointerLeave={() => {
          setZoom(null);
        }}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          {current !== undefined && (
            <motion.div
              key={current.id}
              custom={direction}
              variants={{
                enter: (dir: number) => ({ x: `${String(dir * 30)}%`, opacity: 0, scale: 0.95 }),
                center: { x: 0, opacity: 1, scale: 1 },
                exit: (dir: number) => ({ x: `${String(dir * -30)}%`, opacity: 0, scale: 0.95 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              drag={images.length > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={onDragEnd}
              className="absolute inset-0"
            >
              <img
                src={current.url}
                alt={current.alt ?? name}
                draggable={false}
                className="size-full object-contain p-10 mix-blend-multiply transition-transform duration-200 ease-out select-none dark:mix-blend-normal"
                style={
                  zoom === null
                    ? undefined
                    : {
                        transform: 'scale(2)',
                        transformOrigin: `${String(zoom.x)}% ${String(zoom.y)}%`,
                      }
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 lg:hidden">
            {images.map((image, imageIndex) => (
              <span
                key={image.id}
                className={cn(
                  'h-1.5 rounded-full bg-fg transition-all duration-300',
                  imageIndex === index ? 'w-6' : 'w-1.5 opacity-30',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
