import { ValidationEngine, FormSchema } from './validation.engine';

describe('ValidationEngine', () => {
  let engine: ValidationEngine;

  beforeEach(() => {
    engine = new ValidationEngine();
  });

  const schema: FormSchema = {
    fields: [
      {
        key: 'fullName',
        label: 'Full Name',
        type: 'text',
        rules: { required: true, minLength: 3 },
      },
      {
        key: 'age',
        label: 'Age',
        type: 'number',
        rules: { required: true },
      },
      {
        key: 'birthday',
        label: 'Birthday',
        type: 'date',
        rules: { required: true },
      },
      {
        key: 'contractDate',
        label: 'Contract Date',
        type: 'date',
        rules: { afterField: 'birthday' },
      },
      {
        key: 'department',
        label: 'Department',
        type: 'select',
        rules: { required: true, options: ['HR', 'IT'] },
      },
      {
        key: 'attachment',
        label: 'Attachment',
        type: 'file',
        rules: { maxSizeMb: 5, allowedTypes: ['pdf', 'docx'] },
      },
    ],
  };

  it('should validate valid data', () => {
    const data = {
      fullName: 'John Doe',
      age: 30,
      birthday: '1994-01-01',
      contractDate: '2024-01-01',
      department: 'HR',
      attachment: {
        name: 'policy.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      },
    };
    const result = engine.validate(schema, data);
    expect(result).toHaveLength(0);
  });

  it('should return error if required field is missing', () => {
    const data = {
      fullName: 'John Doe',
      // age is missing
    };
    const result = engine.validate(schema, data);
    expect(result).toContainEqual(
      expect.objectContaining({ field: 'age', i18nKey: 'validation.required' }),
    );
  });

  it('should return error if minLength is violated', () => {
    const data = {
      fullName: 'Jo',
      age: 30,
    };
    const result = engine.validate(schema, data);
    expect(result).toContainEqual(
      expect.objectContaining({
        field: 'fullName',
        i18nKey: 'validation.min_length',
      }),
    );
  });

  it('should return error if type is incorrect (number)', () => {
    const data = {
      fullName: 'John Doe',
      age: 'thirty', // should be number
    };
    const result = engine.validate(schema, data);
    expect(result).toContainEqual(
      expect.objectContaining({
        field: 'age',
        i18nKey: 'validation.type_number',
      }),
    );
  });

  it('should return error if date is invalid', () => {
    const data = {
      fullName: 'John Doe',
      age: 30,
      birthday: 'invalid-date',
    };
    const result = engine.validate(schema, data);
    expect(result).toContainEqual(
      expect.objectContaining({
        field: 'birthday',
        i18nKey: 'validation.type_date',
      }),
    );
  });

  it('should return cross-field error (afterField)', () => {
    const data = {
      fullName: 'John Doe',
      age: 30,
      birthday: '2024-01-01',
      contractDate: '2023-01-01', // Before birthday
      department: 'HR',
    };
    const result = engine.validate(schema, data);
    expect(result).toContainEqual(
      expect.objectContaining({
        field: 'contractDate',
        i18nKey: 'validation.date_after_field',
      }),
    );
  });

  it('should return error if select option is invalid', () => {
    const data = {
      fullName: 'John Doe',
      age: 30,
      birthday: '1994-01-01',
      contractDate: '2024-01-01',
      department: 'SALES',
    };
    const result = engine.validate(schema, data);
    expect(result).toContainEqual(
      expect.objectContaining({
        field: 'department',
        i18nKey: 'validation.invalid_option',
      }),
    );
  });

  it('should return error if file type is not allowed', () => {
    const data = {
      fullName: 'John Doe',
      age: 30,
      birthday: '1994-01-01',
      contractDate: '2024-01-01',
      department: 'HR',
      attachment: {
        name: 'image.png',
        size: 1024,
        mimeType: 'image/png',
      },
    };
    const result = engine.validate(schema, data);
    expect(result).toContainEqual(
      expect.objectContaining({
        field: 'attachment',
        i18nKey: 'validation.file_type_not_allowed',
      }),
    );
  });

  it('should reject unsafe regex patterns (ReDoS)', () => {
    const regexSchema: FormSchema = {
      fields: [
        {
          key: 'input',
          label: 'Input',
          type: 'text',
          rules: { regex: '(a+)+$' },
        },
      ],
    };
    const result = engine.validate(regexSchema, { input: 'aaaaaa' });
    expect(result).toContainEqual(
      expect.objectContaining({
        field: 'input',
        i18nKey: 'validation.unsafe_pattern',
      }),
    );
  });

  it('should validate safe regex patterns normally', () => {
    const regexSchema: FormSchema = {
      fields: [
        {
          key: 'code',
          label: 'Code',
          type: 'text',
          rules: { regex: '^[A-Z]{3}-\\d{4}$' },
        },
      ],
    };
    const pass = engine.validate(regexSchema, { code: 'ABC-1234' });
    expect(pass).toHaveLength(0);

    const fail = engine.validate(regexSchema, { code: 'invalid' });
    expect(fail).toContainEqual(
      expect.objectContaining({ field: 'code', i18nKey: 'validation.pattern' }),
    );
  });

  it('should handle invalid regex syntax gracefully', () => {
    const regexSchema: FormSchema = {
      fields: [
        {
          key: 'input',
          label: 'Input',
          type: 'text',
          rules: { regex: '[invalid' },
        },
      ],
    };
    const result = engine.validate(regexSchema, { input: 'test' });
    expect(result).toContainEqual(
      expect.objectContaining({
        field: 'input',
        i18nKey: expect.stringMatching(
          /validation\.(unsafe_pattern|invalid_pattern)/,
        ),
      }),
    );
  });

  it('should return error if file size exceeds max', () => {
    const data = {
      fullName: 'John Doe',
      age: 30,
      birthday: '1994-01-01',
      contractDate: '2024-01-01',
      department: 'HR',
      attachment: {
        name: 'policy.pdf',
        size: 6 * 1024 * 1024,
        mimeType: 'application/pdf',
      },
    };
    const result = engine.validate(schema, data);
    expect(result).toContainEqual(
      expect.objectContaining({
        field: 'attachment',
        i18nKey: 'validation.file_too_large',
      }),
    );
  });
});
