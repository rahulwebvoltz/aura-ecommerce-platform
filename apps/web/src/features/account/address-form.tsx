import type { AddressDto } from '@ecommerce/types';
import { addressSchema } from '@ecommerce/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, MapPin, Pencil, Phone, Star, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox, Input, Select } from '@/components/ui/field';
import { errorMessage, queryKeys } from '@/lib/query';
import { cn } from '@/lib/utils';
import { ApiError } from '@/services/api-client';
import { addressesApi } from '@/services/shopping.api';

const FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'postalCode',
  'country',
] as const;

const STATES = [
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export function AddressForm({
  address,
  onSaved,
  onCancel,
}: {
  address?: AddressDto;
  onSaved: (address: AddressDto) => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      firstName: address?.firstName ?? '',
      lastName: address?.lastName ?? '',
      phone: address?.phone ?? '',
      addressLine1: address?.addressLine1 ?? '',
      addressLine2: address?.addressLine2 ?? '',
      city: address?.city ?? '',
      state: address?.state ?? '',
      postalCode: address?.postalCode ?? '',
      country: address?.country ?? 'IN',
      isDefault: address?.isDefault ?? false,
    },
  });
  const errors = form.formState.errors;

  const mutation = useMutation({
    mutationFn: (values: Parameters<typeof addressesApi.create>[0]) =>
      address === undefined ? addressesApi.create(values) : addressesApi.update(address.id, values),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
      toast.success(address === undefined ? 'Address saved' : 'Address updated');
      onSaved(saved);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        for (const [field, messages] of Object.entries(error.details)) {
          const name = FIELDS.find((entry) => entry === field);
          if (name !== undefined) {
            form.setError(name, { message: messages[0] ?? error.message });
          }
        }
      }
      toast.error(errorMessage(error));
    },
  });

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          mutation.mutate(values);
        })(event);
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Input
        label="First name"
        autoComplete="given-name"
        error={errors.firstName?.message}
        {...form.register('firstName')}
      />
      <Input
        label="Last name"
        autoComplete="family-name"
        error={errors.lastName?.message}
        {...form.register('lastName')}
      />
      <Input
        label="Phone"
        type="tel"
        autoComplete="tel"
        containerClassName="sm:col-span-2"
        error={errors.phone?.message}
        {...form.register('phone')}
      />
      <Input
        label="Address"
        autoComplete="address-line1"
        containerClassName="sm:col-span-2"
        error={errors.addressLine1?.message}
        {...form.register('addressLine1')}
      />
      <Input
        label="Apartment, suite (optional)"
        autoComplete="address-line2"
        containerClassName="sm:col-span-2"
        error={errors.addressLine2?.message}
        {...form.register('addressLine2')}
      />
      <Input
        label="City"
        autoComplete="address-level2"
        error={errors.city?.message}
        {...form.register('city')}
      />
      <Select label="State" error={errors.state?.message} {...form.register('state')}>
        <option value="">Select a state</option>
        {STATES.map((state) => (
          <option key={state} value={state}>
            {state}
          </option>
        ))}
      </Select>
      <Input
        label="PIN code"
        inputMode="numeric"
        autoComplete="postal-code"
        error={errors.postalCode?.message}
        {...form.register('postalCode')}
      />
      <Input label="Country" readOnly value="India" aria-readonly />
      <Checkbox
        label="Make this my default address"
        className="sm:col-span-2"
        {...form.register('isDefault')}
      />
      <div className="flex justify-end gap-3 sm:col-span-2">
        {onCancel !== undefined && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={mutation.isPending}>
          {address === undefined ? 'Save address' : 'Update address'}
        </Button>
      </div>
    </motion.form>
  );
}

export function AddressCard({
  address,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  address: AddressDto;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const selectable = onSelect !== undefined;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">
          {address.firstName} {address.lastName}
        </p>
        <div className="flex items-center gap-2">
          {address.isDefault && (
            <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
              <Star className="size-3" fill="currentColor" /> Default
            </span>
          )}
          {selectable && (
            <span
              className={cn(
                'grid size-6 place-items-center rounded-full border-2 transition',
                selected === true ? 'border-accent bg-accent text-accent-fg' : 'border-border',
              )}
            >
              {selected === true && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                  <Check className="size-3.5" strokeWidth={3} />
                </motion.span>
              )}
            </span>
          )}
        </div>
      </div>
      <p className="mt-2 flex gap-2 text-sm leading-relaxed text-fg/75">
        <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
        <span>
          {address.addressLine1}
          {address.addressLine2 !== null && `, ${address.addressLine2}`}
          <br />
          {address.city}, {address.state} {address.postalCode}
        </span>
      </p>
      <p className="mt-1.5 flex items-center gap-2 text-sm text-fg/75">
        <Phone className="size-4 text-muted" /> {address.phone}
      </p>
    </>
  );

  return (
    <div
      className={cn(
        'relative rounded-3xl border bg-surface p-5 transition',
        selected === true ? 'border-accent ring-4 ring-ring' : 'border-border',
        selectable && 'hover:border-fg/30',
      )}
    >
      {selectable ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="block w-full text-left"
        >
          {body}
        </button>
      ) : (
        body
      )}
      {(onEdit !== undefined || onDelete !== undefined) && (
        <div className="mt-4 flex gap-2 border-t border-border pt-4">
          {onEdit !== undefined && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
          {onDelete !== undefined && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-sale hover:bg-sale/10"
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
