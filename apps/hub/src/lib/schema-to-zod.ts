import { z } from "zod";
import type { InputSchema, SchemaProperty } from "@/lib/types/service";

/**
 * Determines if a field is required based on the schema's required array
 * and the property-level required flag.
 */
function isFieldRequired(
  fieldName: string,
  schema: InputSchema,
  property: SchemaProperty,
): boolean {
  if (schema.required?.includes(fieldName)) {
    return true;
  }
  return property.required === true;
}

/**
 * Builds a Zod field schema for a single property.
 */
function buildFieldSchema(
  fieldName: string,
  property: SchemaProperty,
  required: boolean,
): z.ZodTypeAny {
  // Enum fields
  if (property.enum && property.enum.length > 0) {
    const enumSchema = z.enum(property.enum as [string, ...string[]]);
    return required ? enumSchema : enumSchema.optional();
  }

  switch (property.type) {
    case "number": {
      const numSchema = z.coerce
        .number()
        .refine((n) => !Number.isNaN(n), { message: "Must be a valid number" });
      return required ? numSchema : numSchema.optional();
    }
    case "boolean": {
      return z.boolean();
    }
    case "string":
    default: {
      if (required) {
        return z.string().min(1, "This field is required");
      }
      return z.string().optional();
    }
  }
}

/**
 * Converts an InputSchema (JSON Schema-like) to a Zod object schema.
 * Handles string, number, boolean, and enum types.
 */
export function buildZodSchema(schema: InputSchema): z.ZodObject<z.ZodRawShape> {
  const entries = Object.entries(schema.properties).map(([fieldName, property]) => {
    const required = isFieldRequired(fieldName, schema, property);
    return [fieldName, buildFieldSchema(fieldName, property, required)] as const;
  });

  const shape = Object.fromEntries(entries) as z.ZodRawShape;
  return z.object(shape);
}

/**
 * Builds default values for a form based on the InputSchema.
 * Returns appropriate zero-values for each field type.
 */
export function buildDefaultValues(schema: InputSchema): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  for (const [fieldName, property] of Object.entries(schema.properties)) {
    // Enum fields default to undefined (no selection)
    if (property.enum && property.enum.length > 0) {
      defaults[fieldName] = undefined;
      continue;
    }

    switch (property.type) {
      case "boolean":
        defaults[fieldName] = false;
        break;
      case "number":
        defaults[fieldName] = undefined;
        break;
      case "string":
      default:
        defaults[fieldName] = "";
        break;
    }
  }

  return defaults;
}
