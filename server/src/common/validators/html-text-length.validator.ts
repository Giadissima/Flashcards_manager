import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// I contenuti creati col TipTap editor arrivano come HTML: contare i
// caratteri della stringa grezza penalizzerebbe chi usa liste/formattazione
// (i tag pesano più del testo effettivo), quindi si valida solo il testo visibile
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

export interface HtmlTextLengthOptions extends ValidationOptions {
  // un editor TipTap "vuoto" produce comunque markup tipo "<p></p>", non una
  // stringa vuota: per i campi opzionali va trattato come nessun contenuto,
  // altrimenti il minimo di caratteri blocca anche chi lascia il campo vuoto
  allowEmpty?: boolean;
}

export function IsHtmlTextLength(
  min: number,
  max: number,
  options?: HtmlTextLengthOptions,
) {
  const { allowEmpty, ...validationOptions } = options ?? {};

  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isHtmlTextLength',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const length = stripHtmlTags(value).length;
          if (allowEmpty && length === 0) return true;
          return length >= min && length <= max;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must contain between ${min} and ${max} characters (formatting tags excluded)`;
        },
      },
    });
  };
}
