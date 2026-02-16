"use client";

import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import type { SchemaProperty } from "@/lib/types/service";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TEXTAREA_THRESHOLD = 200;

interface FieldRendererProps<T extends FieldValues> {
  readonly name: string;
  readonly property: SchemaProperty;
  readonly required: boolean;
  readonly form: UseFormReturn<T>;
}

function getPlaceholder(property: SchemaProperty): string {
  if (property.example !== undefined && property.example !== null) {
    return String(property.example);
  }
  return "";
}

export function FieldRenderer<T extends FieldValues>({
  name,
  property,
  required,
  form,
}: FieldRendererProps<T>) {
  const fieldPath = name as Path<T>;
  const error = form.formState.errors[name];
  const errorMessage = error?.message as string | undefined;

  // Enum field -> Select dropdown
  if (property.enum && property.enum.length > 0) {
    return (
      <div className="space-y-2" data-testid={`field-${name}`}>
        <Label htmlFor={name}>
          {property.description}
          {!required && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
        </Label>
        <Select
          value={(form.watch(fieldPath) as string) ?? ""}
          onValueChange={(value) => {
            form.setValue(fieldPath, value as T[typeof fieldPath], {
              shouldValidate: true,
            });
          }}
        >
          <SelectTrigger
            id={name}
            className="w-full"
            aria-invalid={!!error}
            data-testid={`select-${name}`}
          >
            <SelectValue placeholder={`Select ${property.description}`} />
          </SelectTrigger>
          <SelectContent>
            {property.enum.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errorMessage && (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  // Boolean field -> Checkbox
  if (property.type === "boolean") {
    return (
      <div className="flex items-center space-x-2" data-testid={`field-${name}`}>
        <Checkbox
          id={name}
          checked={(form.watch(fieldPath) as boolean) ?? false}
          onCheckedChange={(checked) => {
            form.setValue(fieldPath, (checked === true) as T[typeof fieldPath], {
              shouldValidate: true,
            });
          }}
          aria-invalid={!!error}
          data-testid={`checkbox-${name}`}
        />
        <Label htmlFor={name}>{property.description}</Label>
        {errorMessage && (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  // Number field -> Input type="number"
  if (property.type === "number") {
    return (
      <div className="space-y-2" data-testid={`field-${name}`}>
        <Label htmlFor={name}>
          {property.description}
          {!required && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
        </Label>
        <Input
          id={name}
          type="number"
          placeholder={getPlaceholder(property)}
          aria-invalid={!!error}
          data-testid={`input-${name}`}
          {...form.register(fieldPath, {
            setValueAs: (v: string) => (v === "" ? undefined : Number(v)),
          })}
        />
        {errorMessage && (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  // String field -> Textarea if maxLength exceeds threshold, else Input
  const hasLongMaxLength =
    typeof property.maxLength === "number" && property.maxLength > TEXTAREA_THRESHOLD;
  const useTextarea = hasLongMaxLength;

  return (
    <div className="space-y-2" data-testid={`field-${name}`}>
      <Label htmlFor={name}>
        {property.description}
        {!required && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
      </Label>
      {useTextarea ? (
        <Textarea
          id={name}
          placeholder={getPlaceholder(property)}
          aria-invalid={!!error}
          data-testid={`textarea-${name}`}
          {...form.register(fieldPath)}
        />
      ) : (
        <Input
          id={name}
          type="text"
          placeholder={getPlaceholder(property)}
          aria-invalid={!!error}
          data-testid={`input-${name}`}
          {...form.register(fieldPath)}
        />
      )}
      {errorMessage && (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
