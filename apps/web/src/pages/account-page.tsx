import type { AddressDto } from '@ecommerce/types';
import {
  changePasswordSchema,
  type ChangePasswordInput,
  updateProfileSchema,
} from '@ecommerce/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, MailCheck, MailWarning, MapPin, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/display';
import { Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/overlay';
import { AccountShell } from '@/features/account/account-shell';
import { AddressCard, AddressForm } from '@/features/account/address-form';
import { useDocumentTitle } from '@/hooks/use-utils';
import { errorMessage, queryKeys } from '@/lib/query';
import { formatDate } from '@/lib/utils';
import { ApiError } from '@/services/api-client';
import { authApi } from '@/services/auth.api';
import { addressesApi } from '@/services/shopping.api';
import { useAuthStore } from '@/stores/auth.store';

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[28px] border border-border bg-surface p-6 sm:p-8"
    >
      <h2 className="text-xl font-semibold">{title}</h2>
      {description !== undefined && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </motion.section>
  );
}

export function ProfilePage() {
  useDocumentTitle('Your account');
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const form = useForm({
    resolver: zodResolver(updateProfileSchema),
    values: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? null,
    },
  });
  const update = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (updated) => {
      setUser(updated);
      toast.success('Profile updated');
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });
  const resend = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: (result) => {
      toast.success(result.message);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  if (user === null) {
    return null;
  }

  return (
    <AccountShell
      title={`Hi, ${user.firstName}`}
      description={`Member since ${formatDate(user.createdAt)}`}
    >
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={
            user.emailVerified
              ? 'flex items-center gap-3 rounded-3xl bg-success/10 p-5 text-sm text-success'
              : 'flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-warning/10 p-5 text-sm'
          }
        >
          {user.emailVerified ? (
            <>
              <MailCheck className="size-5" /> {user.email} is verified.
            </>
          ) : (
            <>
              <span className="flex items-center gap-3">
                <MailWarning className="size-5 text-warning" /> Verify {user.email} to secure your
                account.
              </span>
              <Button
                size="sm"
                variant="outline"
                loading={resend.isPending}
                onClick={() => {
                  resend.mutate();
                }}
              >
                Resend link
              </Button>
            </>
          )}
        </motion.div>

        <Card
          title="Personal details"
          description="This is how we’ll address you and contact you about orders."
        >
          <form
            noValidate
            onSubmit={(event) => {
              void form.handleSubmit((values) => {
                update.mutate(values);
              })(event);
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Input
              label="First name"
              error={form.formState.errors.firstName?.message}
              {...form.register('firstName')}
            />
            <Input
              label="Last name"
              error={form.formState.errors.lastName?.message}
              {...form.register('lastName')}
            />
            <Input
              label="Email"
              value={user.email}
              readOnly
              aria-readonly
              hint="Contact support to change your email."
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="+91 98765 43210"
              error={form.formState.errors.phone?.message}
              {...form.register('phone', {
                setValueAs: (value: unknown) => (value === '' ? null : value),
              })}
            />
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AccountShell>
  );
}

export function AddressesPage() {
  useDocumentTitle('Addresses');
  const queryClient = useQueryClient();
  const addresses = useQuery({ queryKey: queryKeys.addresses, queryFn: addressesApi.list });
  const [editing, setEditing] = useState<AddressDto | 'new' | null>(null);
  const remove = useMutation({
    mutationFn: addressesApi.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
      toast.success('Address removed');
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <AccountShell title="Addresses" description="Saved addresses make checkout a single tap.">
      {addresses.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-44 rounded-3xl" />
        </div>
      ) : addresses.data?.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-7" />}
          title="No saved addresses"
          description="Add one now and you’ll breeze through checkout next time."
          action={
            <Button
              onClick={() => {
                setEditing('new');
              }}
            >
              <Plus className="size-4" /> Add address
            </Button>
          }
        />
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {addresses.data?.map((address) => (
              <motion.div key={address.id} layout exit={{ opacity: 0, scale: 0.9 }}>
                <AddressCard
                  address={address}
                  onEdit={() => {
                    setEditing(address);
                  }}
                  onDelete={() => {
                    remove.mutate(address.id);
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          <motion.button
            layout
            type="button"
            onClick={() => {
              setEditing('new');
            }}
            className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
          >
            <Plus className="size-5" /> Add a new address
          </motion.button>
        </motion.div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => {
          setEditing(null);
        }}
        title={editing === 'new' ? 'Add address' : 'Edit address'}
        className="max-w-2xl"
      >
        <div className="max-h-[80vh] overflow-y-auto p-6">
          <h2 className="text-display mb-6 text-3xl">
            {editing === 'new' ? 'New address' : 'Edit address'}
          </h2>
          {editing !== null && (
            <AddressForm
              {...(editing === 'new' ? {} : { address: editing })}
              onSaved={() => {
                setEditing(null);
              }}
              onCancel={() => {
                setEditing(null);
              }}
            />
          )}
        </div>
      </Modal>
    </AccountShell>
  );
}

export function SecurityPage() {
  useDocumentTitle('Security');
  const setSession = useAuthStore((state) => state.setSession);
  const [visible, setVisible] = useState(false);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const change = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: (session) => {
      setSession(session);
      form.reset();
      toast.success('Password changed. Other devices have been signed out.');
    },
    onError: (error) => {
      if (error instanceof ApiError && error.fieldError('currentPassword') !== undefined) {
        form.setError('currentPassword', {
          message: error.fieldError('currentPassword') ?? error.message,
        });
        return;
      }
      toast.error(errorMessage(error));
    },
  });

  const toggle = (
    <button
      type="button"
      onClick={() => {
        setVisible((value) => !value);
      }}
      className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2"
      aria-label={visible ? 'Hide passwords' : 'Show passwords'}
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );

  return (
    <AccountShell
      title="Security"
      description="Keep your account safe with a strong, unique password."
    >
      <Card
        title="Change password"
        description="Changing your password signs you out everywhere else."
      >
        <form
          noValidate
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              change.mutate(values);
            })(event);
          }}
          className="grid max-w-md gap-4"
        >
          <Input
            label="Current password"
            type={visible ? 'text' : 'password'}
            autoComplete="current-password"
            trailing={toggle}
            error={form.formState.errors.currentPassword?.message}
            {...form.register('currentPassword')}
          />
          <Input
            label="New password"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            hint="At least 8 characters, with a letter and a number."
            error={form.formState.errors.newPassword?.message}
            {...form.register('newPassword')}
          />
          <div>
            <Button type="submit" loading={change.isPending}>
              Update password
            </Button>
          </div>
        </form>
      </Card>
    </AccountShell>
  );
}
