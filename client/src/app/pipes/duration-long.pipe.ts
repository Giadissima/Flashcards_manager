import { Pipe, PipeTransform } from '@angular/core';

import { pad, splitDuration } from './duration.pipe';

/**
 * Spelled-out format ("01 h 20 min 05 sec"), dropping the leading units that
 * are zero.
 *
 * Named apart from `duration` on purpose: both pipes are standalone, so the
 * very same `| duration` in a template used to resolve to whichever of the two
 * the component happened to import, and produced a different string.
 */
@Pipe({
  name: 'durationLong',
  standalone: true
})
export class DurationLongPipe implements PipeTransform {

  transform(totalSeconds: number | null | undefined): string {
    if (totalSeconds == null || totalSeconds < 0) return '00:00:00';

    const { hours, minutes, seconds } = splitDuration(totalSeconds);

    if (hours !== 0)
      return `${pad(hours)} h ${pad(minutes)} min ${pad(seconds)} sec`;

    if (minutes !== 0)
      return `${pad(minutes)} min ${pad(seconds)} sec`;

    return `${pad(seconds)} sec`;
  }
}
