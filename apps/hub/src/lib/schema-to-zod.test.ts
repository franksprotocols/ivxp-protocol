import { describe, it, expect } from "vitest";
import { buildZodSchema, buildDefaultValues } from "./schema-to-zod";
import type { InputSchema } from "@/lib/types/service";

describe("buildZodSchema", () => {
  it("creates a schema for required string fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        text: { type: "string", description: "The text", required: true },
      },
      required: ["text"],
    };

    const schema = buildZodSchema(input);
    const valid = schema.safeParse({ text: "hello" });
    expect(valid.success).toBe(true);

    const invalid = schema.safeParse({ text: "" });
    expect(invalid.success).toBe(false);

    const missing = schema.safeParse({});
    expect(missing.success).toBe(false);
  });

  it("creates a schema for optional string fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        note: { type: "string", description: "Optional note", required: false },
      },
    };

    const schema = buildZodSchema(input);
    const withValue = schema.safeParse({ note: "hi" });
    expect(withValue.success).toBe(true);

    const withoutValue = schema.safeParse({});
    expect(withoutValue.success).toBe(true);

    const withEmpty = schema.safeParse({ note: "" });
    expect(withEmpty.success).toBe(true);
  });

  it("creates a schema for number fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        width: { type: "number", description: "Width in px", required: true },
      },
      required: ["width"],
    };

    const schema = buildZodSchema(input);
    expect(schema.safeParse({ width: 512 }).success).toBe(true);
    expect(schema.safeParse({ width: "abc" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("creates a schema for optional number fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        height: {
          type: "number",
          description: "Height",
          required: false,
        },
      },
    };

    const schema = buildZodSchema(input);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ height: 256 }).success).toBe(true);
  });

  it("creates a schema for boolean fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        verbose: {
          type: "boolean",
          description: "Verbose output",
          required: true,
        },
      },
      required: ["verbose"],
    };

    const schema = buildZodSchema(input);
    expect(schema.safeParse({ verbose: true }).success).toBe(true);
    expect(schema.safeParse({ verbose: false }).success).toBe(true);
    expect(schema.safeParse({ verbose: "yes" }).success).toBe(false);
  });

  it("creates a schema for enum fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        format: {
          type: "string",
          description: "Output format",
          required: true,
          enum: ["json", "csv", "xml"],
        },
      },
      required: ["format"],
    };

    const schema = buildZodSchema(input);
    expect(schema.safeParse({ format: "json" }).success).toBe(true);
    expect(schema.safeParse({ format: "invalid" }).success).toBe(false);
  });

  it("creates a schema for optional enum fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        format: {
          type: "string",
          description: "Output format",
          required: false,
          enum: ["json", "csv", "xml"],
        },
      },
    };

    const schema = buildZodSchema(input);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ format: undefined }).success).toBe(true);
    expect(schema.safeParse({ format: "json" }).success).toBe(true);
    expect(schema.safeParse({ format: "invalid" }).success).toBe(false);
  });

  it("uses required array to determine required fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        text: { type: "string", description: "Text" },
        lang: { type: "string", description: "Language" },
      },
      required: ["text"],
    };

    const schema = buildZodSchema(input);
    expect(schema.safeParse({ text: "hello" }).success).toBe(true);
    expect(schema.safeParse({ lang: "en" }).success).toBe(false);
  });

  it("handles mixed required and optional fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Prompt",
          required: true,
        },
        width: {
          type: "number",
          description: "Width",
          required: false,
        },
        height: {
          type: "number",
          description: "Height",
          required: false,
        },
      },
      required: ["prompt"],
    };

    const schema = buildZodSchema(input);
    expect(schema.safeParse({ prompt: "test" }).success).toBe(true);
    expect(schema.safeParse({ prompt: "test", width: 512, height: 512 }).success).toBe(true);
    expect(schema.safeParse({ width: 512 }).success).toBe(false);
  });

  it("handles empty properties", () => {
    const input: InputSchema = {
      type: "object",
      properties: {},
    };

    const schema = buildZodSchema(input);
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("treats unknown types as string", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        data: {
          type: "object",
          description: "Complex data",
          required: true,
        },
      },
      required: ["data"],
    };

    const schema = buildZodSchema(input);
    expect(schema.safeParse({ data: "some json string" }).success).toBe(true);
  });
});

describe("buildDefaultValues", () => {
  it("returns empty strings for string fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        text: { type: "string", description: "Text" },
      },
    };

    expect(buildDefaultValues(input)).toEqual({ text: "" });
  });

  it("returns undefined for number fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        width: { type: "number", description: "Width" },
      },
    };

    expect(buildDefaultValues(input)).toEqual({ width: undefined });
  });

  it("returns false for boolean fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        verbose: { type: "boolean", description: "Verbose" },
      },
    };

    expect(buildDefaultValues(input)).toEqual({ verbose: false });
  });

  it("returns undefined for enum fields", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        format: {
          type: "string",
          description: "Format",
          enum: ["json", "csv"],
        },
      },
    };

    expect(buildDefaultValues(input)).toEqual({ format: undefined });
  });

  it("handles mixed field types", () => {
    const input: InputSchema = {
      type: "object",
      properties: {
        text: { type: "string", description: "Text" },
        count: { type: "number", description: "Count" },
        flag: { type: "boolean", description: "Flag" },
      },
    };

    expect(buildDefaultValues(input)).toEqual({
      text: "",
      count: undefined,
      flag: false,
    });
  });
});
