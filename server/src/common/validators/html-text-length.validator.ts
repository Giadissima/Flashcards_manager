import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

import { containsImage, stripHtmlTags } from '../html.util';

// Counting the characters of the raw HTML would penalise whoever uses lists
// or formatting, since the tags weigh more than the actual text: only the
// visible text is validated, and an image counts as content on its own.

export interface HtmlTextLengthOptions extends ValidationOptions {
  // An "empty" TipTap editor still produces markup such as "<p></p>", not an
  // empty string: for optional fields that has to count as no content at all,
  // otherwise the minimum length would reject a field left blank.
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
          const hasImage = containsImage(value);
          if (allowEmpty && length === 0 && !hasImage) return true;
          if (length > max) return false;
          if (length >= min) return true;
          // below the minimum text length: still valid if there is an image
          return hasImage;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must contain between ${min} and ${max} characters (formatting tags excluded)`;
        },
      },
    });
  };
}
