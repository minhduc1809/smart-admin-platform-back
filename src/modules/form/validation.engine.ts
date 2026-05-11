import { Injectable } from '@nestjs/common';

export interface SchemaField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  options?: any[];
}

export interface FormSchema {
  fields: SchemaField[];
}

@Injectable()
export class ValidationEngine {
  validate(schema: FormSchema, data: any): { valid: boolean; errors: any[] } {
    const errors = [];

    if (!schema || !schema.fields) {
      return { valid: true, errors: [] };
    }

    for (const field of schema.fields) {
      const value = data[field.name];

      // 1. Required Check
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push({ field: field.name, error: 'validation.REQUIRED' });
        continue;
      }

      if (value === undefined || value === null || value === '') continue;

      // 2. Type/Constraints Check
      switch (field.type) {
        case 'text':
        case 'textarea':
          if (typeof value !== 'string') {
            errors.push({ field: field.name, error: 'validation.MUST_BE_STRING' });
          } else {
            if (field.minLength && value.length < field.minLength) {
              errors.push({ field: field.name, error: 'validation.MIN_LENGTH' });
            }
            if (field.maxLength && value.length > field.maxLength) {
              errors.push({ field: field.name, error: 'validation.MAX_LENGTH' });
            }
          }
          break;
        case 'number':
          if (typeof value !== 'number') {
            errors.push({ field: field.name, error: 'validation.MUST_BE_NUMBER' });
          }
          break;
        case 'date':
          if (isNaN(Date.parse(value))) {
            errors.push({ field: field.name, error: 'validation.INVALID_DATE' });
          }
          break;
        case 'select':
          if (field.options && !field.options.includes(value)) {
            errors.push({ field: field.name, error: 'validation.INVALID_OPTION' });
          }
          break;
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
