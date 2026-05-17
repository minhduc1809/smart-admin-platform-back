import { Injectable } from '@nestjs/common';

export interface SchemaField {
  key: string;
  label: string;
  type: string;
  options?: any[];
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

      if (fieldDef.type === 'select') {
        const options = this.resolveSelectOptions(fieldDef, rules);
        if (options.length > 0) {
          const values = Array.isArray(value) ? value : [value];
          const invalid = values.filter((item) => !options.includes(item));
          if (invalid.length > 0) {
            errors.push({
              field: fieldDef.key,
              i18nKey: 'validation.invalid_option',
              params: { options },
            });
          }
        }
      }

      if (fieldDef.type === 'file') {
        const files = Array.isArray(value) ? value : [value];
        const allowedTypes = this.normalizeAllowedTypes(rules.allowedTypes);
        const maxSizeMb = rules.maxSizeMb;

        let sizeExceeded = false;
        let typeInvalid = false;

        for (const fileValue of files) {
          const fileInfo = this.getFileInfo(fileValue);
          if (!fileInfo) continue;

          if (
            maxSizeMb !== undefined &&
            fileInfo.sizeBytes !== undefined &&
            fileInfo.sizeBytes > maxSizeMb * 1024 * 1024
          ) {
            sizeExceeded = true;
          }

          if (allowedTypes.length > 0 && !this.isAllowedFileType(fileInfo, allowedTypes)) {
            typeInvalid = true;
          }
        }

        if (sizeExceeded) {
          errors.push({
            field: fieldDef.key,
            i18nKey: 'validation.file_too_large',
            params: { maxMb: maxSizeMb },
          });
        }

        if (typeInvalid) {
          errors.push({
            field: fieldDef.key,
            i18nKey: 'validation.file_type_not_allowed',
            params: { types: rules.allowedTypes },
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

  private resolveSelectOptions(fieldDef: SchemaField, rules: Record<string, any>): any[] {
    if (Array.isArray(rules.options)) return rules.options;
    if (Array.isArray(fieldDef.options)) return fieldDef.options;
    if (Array.isArray(rules.allowedValues)) return rules.allowedValues;
    return [];
  }

  private getFileInfo(value: any): {
    sizeBytes?: number;
    mimeType?: string;
    name?: string;
  } | null {
    if (!value || typeof value !== 'object') return null;

    const sizeRaw = value.sizeBytes ?? value.size ?? value.fileSize;
    const sizeBytes = this.toNumberOrUndefined(sizeRaw);
    const mimeTypeRaw = value.mimeType ?? value.mimetype ?? value.type;
    const nameRaw = value.name ?? value.originalName ?? value.filename ?? value.fileName;
    const mimeType = typeof mimeTypeRaw === 'string' ? mimeTypeRaw.trim() : undefined;
    const name = typeof nameRaw === 'string' ? nameRaw.trim() : undefined;

    if (sizeBytes === undefined && !mimeType && !name) return null;

    return {
      sizeBytes,
      mimeType,
      name,
    };
  }

  private normalizeAllowedTypes(types: unknown): string[] {
    if (!Array.isArray(types)) return [];
    return types
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean)
      .map((item) => (item.startsWith('.') ? item.slice(1) : item));
  }

  private isAllowedFileType(
    fileInfo: { mimeType?: string; name?: string },
    allowedTypes: string[],
  ): boolean {
    const mimeType = fileInfo.mimeType?.toLowerCase();
    const extension = this.getExtension(fileInfo.name);
    const mimeSubtype = mimeType?.includes('/') ? mimeType.split('/')[1] : undefined;

    if (mimeType && allowedTypes.some((type) => type.includes('/') && type === mimeType)) {
      return true;
    }

    if (mimeSubtype && allowedTypes.includes(mimeSubtype)) {
      return true;
    }

    if (extension && allowedTypes.includes(extension)) {
      return true;
    }

    if (extension && this.isJpegAlias(extension, allowedTypes)) {
      return true;
    }

    if (mimeSubtype && this.isJpegAlias(mimeSubtype, allowedTypes)) {
      return true;
    }

    return false;
  }

  private isJpegAlias(value: string, allowedTypes: string[]): boolean {
    if (value === 'jpg' && allowedTypes.includes('jpeg')) return true;
    if (value === 'jpeg' && allowedTypes.includes('jpg')) return true;
    return false;
  }

  private getExtension(name?: string): string | undefined {
    if (!name) return undefined;
    const idx = name.lastIndexOf('.');
    if (idx <= 0 || idx === name.length - 1) return undefined;
    return name.slice(idx + 1).toLowerCase();
  }

  private toNumberOrUndefined(value: unknown): number | undefined {
    if (value === undefined || value === null) return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private isEmpty(value: any): boolean {
    return value === undefined || value === null || String(value).trim() === '';
  }
}
