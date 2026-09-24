/**
 * API contract. Each response shape is a Zod schema so the API compiles against the inferred
 * types and the storefront validates what it receives at runtime.
 *
 * All monetary amounts are integers in minor units (paise). All dates are ISO-8601 strings.
 */
import {
  COUPON_TYPES,
  FULFILLMENT_STATUSES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  REVIEW_STATUSES,
  USER_ROLES,
} from '@ecommerce/shared';
import { z } from 'zod';

/* -------------------------------------------------------------------------------------------------
 * Envelopes
 * -----------------------------------------------------------------------------------------------*/

export const apiSuccessSchema = <T extends z.ZodType>(data: T) => z.object({ data });
export interface ApiSuccess<T> {
  data: T;
}

export const paginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), meta: paginationMetaSchema });
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.array(z.string())).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

/* -------------------------------------------------------------------------------------------------
 * Auth & users
 * -----------------------------------------------------------------------------------------------*/

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  role: z.enum(USER_ROLES),
  emailVerified: z.boolean(),
  createdAt: z.string(),
});
export type UserDto = z.infer<typeof userSchema>;

export const authSessionSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
  /** Access-token lifetime in seconds. */
  expiresIn: z.number(),
});
export type AuthSessionDto = z.infer<typeof authSessionSchema>;

export const messageSchema = z.object({ message: z.string() });
export type MessageDto = z.infer<typeof messageSchema>;

export const addressSnapshotSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
});
/** Address copied onto an order so history survives later address edits. */
export type AddressSnapshot = z.infer<typeof addressSnapshotSchema>;

export const addressResponseSchema = addressSnapshotSchema.extend({
  id: z.string(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AddressDto = z.infer<typeof addressResponseSchema>;

/* -------------------------------------------------------------------------------------------------
 * Catalog
 * -----------------------------------------------------------------------------------------------*/

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  productCount: number;
  children: CategoryDto[];
}

export const categorySchema: z.ZodType<CategoryDto> = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  parentId: z.string().nullable(),
  productCount: z.number(),
  get children() {
    return z.array(categorySchema);
  },
});

export const brandSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  logo: z.string().nullable(),
  productCount: z.number(),
});
export type BrandDto = z.infer<typeof brandSchema>;

export const productImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  alt: z.string().nullable(),
  sortOrder: z.number(),
});
export type ProductImageDto = z.infer<typeof productImageSchema>;

export const variantAttributesSchema = z.record(z.string(), z.string());
export type VariantAttributes = z.infer<typeof variantAttributesSchema>;

export const productVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  price: z.number(),
  compareAtPrice: z.number().nullable(),
  stock: z.number(),
  attributes: variantAttributesSchema,
});
export type ProductVariantDto = z.infer<typeof productVariantSchema>;

export const categoryRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });
export type CategoryRefDto = z.infer<typeof categoryRefSchema>;
export const brandRefSchema = categoryRefSchema;
export type BrandRefDto = CategoryRefDto;

export const productSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  shortDescription: z.string().nullable(),
  price: z.number(),
  compareAtPrice: z.number().nullable(),
  /** Total purchasable stock across the product or its variants. */
  stock: z.number(),
  ratingAverage: z.number(),
  ratingCount: z.number(),
  image: productImageSchema.nullable(),
  hoverImage: productImageSchema.nullable(),
  category: categoryRefSchema,
  brand: brandRefSchema.nullable(),
  hasVariants: z.boolean(),
  createdAt: z.string(),
});
export type ProductSummaryDto = z.infer<typeof productSummarySchema>;

export const variantOptionSchema = z.object({ name: z.string(), values: z.array(z.string()) });
export type VariantOptionDto = z.infer<typeof variantOptionSchema>;

export const productDetailSchema = productSummarySchema.extend({
  description: z.string(),
  sku: z.string(),
  images: z.array(productImageSchema),
  variants: z.array(productVariantSchema),
  options: z.array(variantOptionSchema),
  breadcrumbs: z.array(categoryRefSchema),
});
export type ProductDetailDto = z.infer<typeof productDetailSchema>;

const facetEntrySchema = categoryRefSchema.extend({ count: z.number() });

export const productFacetsSchema = z.object({
  categories: z.array(facetEntrySchema),
  brands: z.array(facetEntrySchema),
  priceRange: z.object({ min: z.number(), max: z.number() }),
  attributes: z.array(variantOptionSchema),
});
export type ProductFacetsDto = z.infer<typeof productFacetsSchema>;

export interface CategoryDetailDto extends CategoryDto {
  breadcrumbs: CategoryRefDto[];
}

export const categoryDetailSchema: z.ZodType<CategoryDetailDto> = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  parentId: z.string().nullable(),
  productCount: z.number(),
  children: z.array(categorySchema),
  breadcrumbs: z.array(categoryRefSchema),
});

/* -------------------------------------------------------------------------------------------------
 * Cart & wishlist
 * -----------------------------------------------------------------------------------------------*/

export const cartItemSchema = z.object({
  id: z.string(),
  quantity: z.number(),
  /** Current unit price from the catalog, not the price captured when the item was added. */
  unitPrice: z.number(),
  compareAtPrice: z.number().nullable(),
  lineTotal: z.number(),
  /** True when the catalog price differs from the price captured when the item was added. */
  priceChanged: z.boolean(),
  availableStock: z.number(),
  product: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    image: productImageSchema.nullable(),
    brand: z.string().nullable(),
  }),
  variant: z
    .object({ id: z.string(), sku: z.string(), attributes: variantAttributesSchema })
    .nullable(),
});
export type CartItemDto = z.infer<typeof cartItemSchema>;

export const cartSummarySchema = z.object({
  itemCount: z.number(),
  subtotal: z.number(),
  /** Amount still needed to qualify for free shipping, or 0 if already qualified. */
  freeShippingRemaining: z.number(),
});
export type CartSummaryDto = z.infer<typeof cartSummarySchema>;

export const cartSchema = z.object({
  id: z.string(),
  items: z.array(cartItemSchema),
  summary: cartSummarySchema,
});
export type CartDto = z.infer<typeof cartSchema>;

export const wishlistItemSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  product: productSummarySchema,
});
export type WishlistItemDto = z.infer<typeof wishlistItemSchema>;

export const wishlistSchema = z.object({ id: z.string(), items: z.array(wishlistItemSchema) });
export type WishlistDto = z.infer<typeof wishlistSchema>;

/* -------------------------------------------------------------------------------------------------
 * Checkout, orders & payments
 * -----------------------------------------------------------------------------------------------*/

export const couponValidationSchema = z.object({
  code: z.string(),
  type: z.enum(COUPON_TYPES),
  value: z.number(),
  discount: z.number(),
  description: z.string(),
});
export type CouponValidationDto = z.infer<typeof couponValidationSchema>;

export const checkoutTotalsSchema = z.object({
  subtotal: z.number(),
  discount: z.number(),
  shipping: z.number(),
  tax: z.number(),
  total: z.number(),
  currency: z.string(),
});
export type CheckoutTotalsDto = z.infer<typeof checkoutTotalsSchema>;

export const orderItemSchema = z.object({
  id: z.string(),
  productId: z.string().nullable(),
  variantId: z.string().nullable(),
  productName: z.string(),
  productSlug: z.string().nullable(),
  sku: z.string(),
  image: z.string().nullable(),
  attributes: variantAttributesSchema.nullable(),
  price: z.number(),
  quantity: z.number(),
  total: z.number(),
  reviewed: z.boolean(),
});
export type OrderItemDto = z.infer<typeof orderItemSchema>;

export const orderSummarySchema = checkoutTotalsSchema.extend({
  id: z.string(),
  orderNumber: z.string(),
  status: z.enum(ORDER_STATUSES),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  fulfillmentStatus: z.enum(FULFILLMENT_STATUSES),
  paymentMethod: z.enum(PAYMENT_METHODS),
  itemCount: z.number(),
  previewImages: z.array(z.string()),
  createdAt: z.string(),
});
export type OrderSummaryDto = z.infer<typeof orderSummarySchema>;

export const orderEventSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type OrderEventDto = z.infer<typeof orderEventSchema>;

export const orderDetailSchema = orderSummarySchema.extend({
  couponCode: z.string().nullable(),
  shippingAddress: addressSnapshotSchema,
  billingAddress: addressSnapshotSchema,
  items: z.array(orderItemSchema),
  events: z.array(orderEventSchema),
  canCancel: z.boolean(),
  updatedAt: z.string(),
});
export type OrderDetailDto = z.infer<typeof orderDetailSchema>;

export const razorpayCheckoutSchema = z.object({
  provider: z.literal('RAZORPAY'),
  keyId: z.string(),
  providerOrderId: z.string(),
  orderNumber: z.string(),
  amount: z.number(),
  currency: z.string(),
  prefill: z.object({ name: z.string(), email: z.string(), contact: z.string() }),
});
export type RazorpayCheckoutDto = z.infer<typeof razorpayCheckoutSchema>;

export const codCheckoutSchema = z.object({ provider: z.literal('COD') });
export type CodCheckoutDto = z.infer<typeof codCheckoutSchema>;

export const paymentInitSchema = z.discriminatedUnion('provider', [
  razorpayCheckoutSchema,
  codCheckoutSchema,
]);
export type PaymentInitDto = z.infer<typeof paymentInitSchema>;

export const checkoutResultSchema = z.object({
  order: orderDetailSchema,
  /** Null when the payment provider could not be reached; retry with `POST /api/payments/create`. */
  payment: paymentInitSchema.nullable(),
});
export type CheckoutResultDto = z.infer<typeof checkoutResultSchema>;

export const paymentMethodsSchema = z.object({
  methods: z.array(
    z.object({ id: z.enum(PAYMENT_METHODS), label: z.string(), enabled: z.boolean() }),
  ),
});
export type PaymentMethodsDto = z.infer<typeof paymentMethodsSchema>;

/* -------------------------------------------------------------------------------------------------
 * Reviews
 * -----------------------------------------------------------------------------------------------*/

export const reviewResponseSchema = z.object({
  id: z.string(),
  rating: z.number(),
  title: z.string(),
  comment: z.string(),
  status: z.enum(REVIEW_STATUSES),
  verifiedPurchase: z.boolean(),
  author: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ReviewDto = z.infer<typeof reviewResponseSchema>;

export const reviewSummarySchema = z.object({
  average: z.number(),
  count: z.number(),
  /** Counts of reviews per star rating, index 0 = 1 star. */
  distribution: z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]),
});
export type ReviewSummaryDto = z.infer<typeof reviewSummarySchema>;

export const productReviewsSchema = paginatedSchema(reviewResponseSchema).extend({
  summary: reviewSummarySchema,
});
export type ProductReviewsDto = z.infer<typeof productReviewsSchema>;

export const reviewEligibilitySchema = z.object({
  canReview: z.boolean(),
  reason: z.enum(['NOT_AUTHENTICATED', 'NOT_PURCHASED', 'ALREADY_REVIEWED']).nullable(),
  orderId: z.string().nullable(),
});
export type ReviewEligibilityDto = z.infer<typeof reviewEligibilitySchema>;
