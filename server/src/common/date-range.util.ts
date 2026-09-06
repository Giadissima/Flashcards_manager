import { DateRangeRequest } from 'src/common.dto';

/**
 * The two ends of a range as a condition on one date field, or undefined when
 * neither end was given - so a caller can drop it into a query without first
 * asking whether there is anything to add.
 *
 * The far end is exclusive and lands on the day after: the field holds an
 * instant while the input names a day, and a range ending "on the 6th" has to
 * take in everything that happened during the 6th rather than stop at its
 * first moment.
 *
 * Both ends are read as UTC days, which is what a plain YYYY-MM-DD means to
 * Date. The browser sends the day somebody picked and not the timezone they
 * picked it in, so no other reading is available here.
 */
export function dateRangeQuery(
  range: DateRangeRequest,
): { $gte?: Date; $lt?: Date } | undefined {
  const condition: { $gte?: Date; $lt?: Date } = {};

  if (range.from) condition.$gte = new Date(range.from);
  if (range.to) {
    const end = new Date(range.to);
    end.setUTCDate(end.getUTCDate() + 1);
    condition.$lt = end;
  }

  return Object.keys(condition).length ? condition : undefined;
}
