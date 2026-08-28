import { Pipe, PipeTransform } from '@angular/core';

export const pad = (n: number) => n.toString().padStart(2, '0');

/** Splits a duration in seconds into its hours / minutes / seconds parts. */
export function splitDuration(totalSeconds: number) {
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/** Clock format: "mm:ss", or "hh:mm:ss" once the duration passes one hour. */
@Pipe({
  name: 'duration',
  standalone: true
})
export class DurationPipe implements PipeTransform {

  transform(totalSeconds: number | null | undefined): string {
    if (totalSeconds == null || totalSeconds < 0) return '00:00';

    const { hours, minutes, seconds } = splitDuration(totalSeconds);

    if (hours === 0)
      return `${pad(minutes)}:${pad(seconds)}`;

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
}
