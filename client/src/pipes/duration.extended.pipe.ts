import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'duration',
  standalone: true
})
export class DurationExtendedFormatPipe implements PipeTransform {

  transform(totalSeconds: number | null | undefined): string {
    if (totalSeconds == null || totalSeconds < 0) return '00:00:00';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');

    if(hours != 0)
      return `${pad(hours)} h ${pad(minutes)} min ${pad(seconds)} sec`;
    
    if(minutes != 0)
      return `${pad(minutes)} min ${pad(seconds)} sec`;

    return `${pad(seconds)} sec`;

  }
}