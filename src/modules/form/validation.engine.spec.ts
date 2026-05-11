import { ValidationEngine, FormSchema } from './validation.engine';

describe('ValidationEngine', () => {
  let engine: ValidationEngine;

  beforeEach(() => {
    engine = new ValidationEngine();
  });

  const schema: FormSchema = {
    fields: [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true, minLength: 3 },
      { name: 'age', label: 'Age', type: 'number', required: true },
      { name: 'gender', label: 'Gender', type: 'select', options: ['male', 'female', 'other'] },
      { name: 'birthday', label: 'Birthday', type: 'date' },
    ],
  };

  it('should validate valid data', () => {
    const data = {
      fullName: 'John Doe',
      age: 30,
      gender: 'male',
      birthday: '1994-01-01',
    };
    const result = engine.validate(schema, data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return error if required field is missing', () => {
    const data = {
      fullName: 'John Doe',
      // age is missing
    };
    const result = engine.validate(schema, data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'age', error: 'validation.REQUIRED' });
  });

  it('should return error if minLength is violated', () => {
    const data = {
      fullName: 'Jo',
      age: 30,
    };
    const result = engine.validate(schema, data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'fullName', error: 'validation.MIN_LENGTH' });
  });

  it('should return error if type is incorrect (number)', () => {
    const data = {
      fullName: 'John Doe',
      age: 'thirty', // should be number
    };
    const result = engine.validate(schema, data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'age', error: 'validation.MUST_BE_NUMBER' });
  });

  it('should return error if select option is invalid', () => {
    const data = {
      fullName: 'John Doe',
      age: 30,
      gender: 'unknown',
    };
    const result = engine.validate(schema, data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'gender', error: 'validation.INVALID_OPTION' });
  });

  it('should return error if date is invalid', () => {
    const data = {
      fullName: 'John Doe',
      age: 30,
      birthday: 'invalid-date',
    };
    const result = engine.validate(schema, data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'birthday', error: 'validation.INVALID_DATE' });
  });
});
