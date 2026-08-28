import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FilterQuery, Model, SortOrder, Types, UpdateQuery } from 'mongoose';

import { BasePaginatedResult, BasicFilterRequest } from 'src/common.dto';
import { idLength } from 'src/config';

/**
 * Shared Mongo helpers: every collection exposes the same list/update/delete
 * shape, so the query building lives here once instead of being copy-pasted in
 * each service.
 */

export function isValidObjectId(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length === idLength &&
    Types.ObjectId.isValid(id)
  );
}

/** Guard used by every route that receives an id as a path parameter. */
export function assertValidObjectId(id: string): void {
  if (!isValidObjectId(id)) {
    throw new BadRequestException('The id does not satisfy requirements');
  }
}

/**
 * One page of documents plus the total count of the matching set, both computed
 * in parallel. '_id' is always the last sort key so that documents sharing the
 * same sortField value keep a stable order across pages.
 */
export async function findPaginated<T>(
  model: Model<any>,
  query: FilterQuery<any>,
  filter: BasicFilterRequest,
  populate?: string | string[],
): Promise<BasePaginatedResult<T>> {
  const page = model
    .find(query)
    .sort([
      [filter.sortField, filter.sortDirection as SortOrder],
      ['_id', 'desc'],
    ])
    .skip(filter.skip)
    .limit(filter.limit);

  if (populate) page.populate(populate as any);

  const [data, count] = await Promise.all([
    page.exec(),
    model.find(query).countDocuments(),
  ]);

  return { data: data as T[], count };
}

export async function deleteByIdOrThrow(
  model: Model<any>,
  id: string,
  entityName: string,
): Promise<void> {
  assertValidObjectId(id);

  const result = await model.deleteOne({ _id: id });
  if (result.deletedCount === 0) {
    throw new NotFoundException(`${entityName} with id ${id} not found`);
  }
}

export async function updateByIdOrThrow(
  model: Model<any>,
  id: string,
  update: UpdateQuery<any>,
  entityName: string,
): Promise<void> {
  assertValidObjectId(id);

  const result = await model
    .findByIdAndUpdate(id, update, { new: true })
    .exec();
  if (!result) {
    throw new NotFoundException(`${entityName} with id ${id} not found`);
  }
}
