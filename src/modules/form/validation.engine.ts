import { Injectable } from '@nestjs/common';

export interface SchemaField {
  key: string;
  label: string;
  type: string;
  rules?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    regex?: string;
    afterField?: string;
    maxSizeMb?: number;
    allowedTypes?: string[];
    [key: string]: any;
  };
}

export interface FormSchema {
  formId?: string;
  fields: SchemaField[];
}

export interface ValidationError {
  field: string;
  i18nKey: string;
  params?: Record<string, any>;
}

@Injectable()
export class ValidationEngine {
  validate(schema: FormSchema, payload: Record<string, any>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!schema || !schema.fields) {
      return errors;
    }

    for (const fieldDef of schema.fields) {
      const value = payload[fieldDef.key];
      const rules = fieldDef.rules ?? {};

      if (rules.required && this.isEmpty(value)) {
        errors.push({ field: fieldDef.key, i18nKey: 'validation.required' });
        continue;
      }
      if (this.isEmpty(value)) continue;

      const typeError = this.checkType(fieldDef.key, value, fieldDef.type);
      if (typeError) {
        errors.push(typeError);
        continue;
      }

      if (fieldDef.type === 'text') {
        if (rules.minLength && String(value).length < rules.minLength) {
          errors.push({
            field: fieldDef.key,
            i18nKey: 'validation.min_length',
            params: { min: rules.minLength },
          });
        }
        if (rules.maxLength && String(value).length > rules.maxLength) {
          errors.push({
            field: fieldDef.key,
            i18nKey: 'validation.max_length',
            params: { max: rules.maxLength },
          });
        }
        if (rules.regex && !new RegExp(rules.regex).test(String(value))) {
          errors.push({ field: fieldDef.key, i18nKey: 'validation.pattern' });
        }
      }

      if (fieldDef.type === 'number') {
        if (rules.min !== undefined && Number(value) < rules.min) {
          errors.push({
            field: fieldDef.key,
            i18nKey: 'validation.min_value',
            params: { min: rules.min },
          });
        }
        if (rules.max !== undefined && Number(value) > rules.max) {
          errors.push({
            field: fieldDef.key,
            i18nKey: 'validation.max_value',
            params: { max: rules.max },
          });
        }
      }
    }

    const crossErrors = this.checkCrossFields(schema, payload);
    errors.push(...crossErrors);

    return errors;
  }

  private checkCrossFields(
    schema: FormSchema,
    payload: Record<string, any>,
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    for (const fieldDef of schema.fields) {
      const rules = fieldDef.rules ?? {};
      if (rules.afterField) {
        const refValue = payload[rules.afterField];
        const thisValue = payload[fieldDef.key];
        if (refValue && thisValue && new Date(thisValue) <= new Date(refValue)) {
          errors.push({
            field: fieldDef.key,
            i18nKey: 'validation.date_after_field',
            params: { refField: rules.afterField },
          });
        }
      }
    }
    return errors;
  }

  private checkType(field: string, value: any, type: string): ValidationError | null {
    if (type === 'number' && isNaN(Number(value)))
      return { field, i18nKey: 'validation.type_number' };
    if (type === 'date' && isNaN(Date.parse(value)))
      return { field, i18nKey: 'validation.type_date' };
    return null;
  }

  private isEmpty(value: any): boolean {
    return value === undefined || value === null || String(value).trim() === '';
  }
}
