"use client";

import type { Control } from "react-hook-form";
import type { ProviderRegistrationFormData } from "@/lib/provider-registration-schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ServiceEntryFieldsProps {
  readonly index: number;
  readonly control: Control<ProviderRegistrationFormData>;
  readonly onRemove?: () => void;
  readonly disabled?: boolean;
}

export function ServiceEntryFields({
  index,
  control,
  onRemove,
  disabled,
}: ServiceEntryFieldsProps) {
  return (
    <Card data-testid={`service-entry-${index}`}>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Service {index + 1}</span>
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={disabled}
              data-testid={`remove-service-${index}`}
            >
              Remove
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control}
            name={`services.${index}.serviceType`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Type *</FormLabel>
                <FormControl>
                  <Input placeholder="text_echo" {...field} disabled={disabled} />
                </FormControl>
                <FormDescription>snake_case identifier</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`services.${index}.name`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Text Echo Service" {...field} disabled={disabled} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name={`services.${index}.description`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service Description *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe what this service does..."
                  {...field}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control}
            name={`services.${index}.priceUsdc`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price (USDC) *</FormLabel>
                <FormControl>
                  <Input placeholder="1.50" {...field} disabled={disabled} />
                </FormControl>
                <FormDescription>Decimal format (e.g., &quot;1.50&quot;)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`services.${index}.estimatedTimeSeconds`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Est. Time (seconds) *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="60" {...field} disabled={disabled} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
