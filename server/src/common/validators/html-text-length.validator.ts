import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// Content written in the TipTap editor arrives as HTML: counting the characters
// of the raw string would penalise whoever uses lists or formatting (the tags
// weigh more than the actual text), so only the visible text is validated.
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

// An image is content in its own right (e.g. an answer made only of the
// requested drawing), but it has no visible text: without this check the
// minimum length would reject a perfectly valid image-only answer.
function containsImage(value: string): boolean {
  return /<img\b/i.test(value);
}

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
