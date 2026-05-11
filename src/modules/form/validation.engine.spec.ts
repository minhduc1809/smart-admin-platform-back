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
    ],
  };

  it('should validate valid data', () => {
    const data = {
      fullName: 'John Doe',
      age: 30,
      birthday: '1994-01-01',
      contractDate: '2024-01-01',
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
      expect.objectContaining({ field: 'age', i18nKey: 'validation.required' })
    );
  });

  it('should return error if minLength is violated', () => {
    const data = {
      fullName: 'Jo',
      age: 30,
    };
    const result = engine.validate(schema, data);
    expect(result).toContainEqual(
      expect.objectContaining({ field: 'fullName', i18nKey: 'validation.min_length' })
    );
  });

  it('should return error if type is incorrect (number)', () => {
    const data = {
      fullName: 'John Doe',
      age: 'thirty', // should be number
    };
    const result = engine.validate(schema, data);
    expect(result).toContainEqual(
      expect.objectContaining({ field: 'age', i18nKey: 'validation.type_number' })
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
      expect.objectContaining({ field: 'birthday', i18nKey: 'validation.type_date' })
    );
  });

  it('should return cross-field error (afterField)', () => {
    const data = {
      fullName: 'John Doe',
      age: 30,
      birthday: '2024-01-01',
      contractDate: '2023-01-01', // Before birthday
    };
    const result = engine.validate(schema, data);
    expect(result).toContainEqual(
      expect.objectContaining({ field: 'contractDate', i18nKey: 'validation.date_after_field' })
    );
  });
});
