import type { Address, Prisma } from '@ecommerce/db';
import type { AddressDto, AddressSnapshot } from '@ecommerce/types';
import type { AddressInput, UpdateAddressInput } from '@ecommerce/validation';

import type { AppContext } from '../../context.js';
import { notFound, unprocessable } from '../../utils/errors.js';

const MAX_ADDRESSES = 20;

export function toAddressDto(address: Address): AddressDto {
  return {
    id: address.id,
    firstName: address.firstName,
    lastName: address.lastName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    isDefault: address.isDefault,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export function toAddressSnapshot(address: Address): AddressSnapshot {
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
  };
}

/** Only the fields present in the request are written. */
function updateData(
  input: UpdateAddressInput,
  isDefault: boolean | undefined,
): Prisma.AddressUpdateInput {
  const data: Prisma.AddressUpdateInput = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.addressLine1 !== undefined) data.addressLine1 = input.addressLine1;
  if (input.addressLine2 !== undefined) data.addressLine2 = input.addressLine2;
  if (input.city !== undefined) data.city = input.city;
  if (input.state !== undefined) data.state = input.state;
  if (input.postalCode !== undefined) data.postalCode = input.postalCode;
  if (input.country !== undefined) data.country = input.country;
  if (isDefault !== undefined) data.isDefault = isDefault;
  return data;
}

export function createAddressesService({ prisma }: AppContext) {
  async function owned(userId: string, id: string): Promise<Address> {
    const address = await prisma.address.findFirst({ where: { id, userId } });
    if (address === null) {
      throw notFound('Address');
    }

    return address;
  }

  return {
    async list(userId: string): Promise<AddressDto[]> {
      const addresses = await prisma.address.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      return addresses.map(toAddressDto);
    },

    async get(userId: string, id: string): Promise<AddressDto> {
      return toAddressDto(await owned(userId, id));
    },

    /** The first address, or one marked default, becomes the only default address. */
    async create(userId: string, input: AddressInput): Promise<AddressDto> {
      const address = await prisma.$transaction(async (tx) => {
        const count = await tx.address.count({ where: { userId } });
        if (count >= MAX_ADDRESSES) {
          throw unprocessable(
            'ADDRESS_LIMIT',
            `You can save up to ${String(MAX_ADDRESSES)} addresses.`,
          );
        }

        const isDefault = input.isDefault || count === 0;
        if (isDefault) {
          await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
        }
        return tx.address.create({ data: { ...input, userId, isDefault } });
      });

      return toAddressDto(address);
    },

    async update(userId: string, id: string, input: UpdateAddressInput): Promise<AddressDto> {
      const current = await owned(userId, id);
      const address = await prisma.$transaction(async (tx) => {
        if (input.isDefault === true) {
          await tx.address.updateMany({
            where: { userId, id: { not: id } },
            data: { isDefault: false },
          });
        }
        // The default address can only change by promoting another one.
        const isDefault = current.isDefault ? true : input.isDefault;
        return tx.address.update({
          where: { id },
          data: updateData(input, isDefault),
        });
      });

      return toAddressDto(address);
    },

    /** Deleting the default promotes the most recently created remaining address. */
    async remove(userId: string, id: string): Promise<void> {
      const current = await owned(userId, id);
      await prisma.$transaction(async (tx) => {
        await tx.address.delete({ where: { id } });
        if (current.isDefault) {
          const next = await tx.address.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });
          if (next !== null) {
            await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
          }
        }
      });
    },

    owned,
  };
}

export type AddressesService = ReturnType<typeof createAddressesService>;
