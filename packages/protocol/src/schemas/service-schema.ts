/**
 * IVXP/1.0 Service Zod Schemas
 *
 * Validates ServiceCatalog and ServiceRequest messages.
 * Wire format uses snake_case; transforms produce camelCase output.
 *
 * Transform logic is extracted into reusable helper functions to avoid
 * duplication between standalone sub-schemas and parent message schemas.
 */

import { z } from "zod";

import {
  DeliveryFormatSchema,
  HexAddressSchema,
  ISOTimestampSchema,
  ProtocolVersionSchema,
} from "./common.js";

// ---------------------------------------------------------------------------
// ServiceDefinition (nested within ServiceCatalog)
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for a single service definition in a catalog.
 */
const ServiceDefinitionWireSchema = z.object({
  type: z.string().min(1),
  base_price_usdc: z.number().nonnegative(),
  estimated_delivery_hours: z.number().positive(),
});

/** Transform wire-format service definition to camelCase. */
function transformServiceDefinition(
  data: z.output<typeof ServiceDefinitionWireSchema>,
) {
  return {
    type: data.type,
    basePriceUsdc: data.base_price_usdc,
    estimatedDeliveryHours: data.estimated_delivery_hours,
  };
}

/**
 * Schema for a service definition with snake_case -> camelCase transform.
 */
export const ServiceDefinitionSchema =
  ServiceDefinitionWireSchema.transform(transformServiceDefinition);

// ---------------------------------------------------------------------------
// ServiceCatalog - GET /ivxp/catalog response
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for ServiceCatalog messages.
 */
const ServiceCatalogWireSchema = z.object({
  protocol: ProtocolVersionSchema,
  provider: z.string().min(1),
  wallet_address: HexAddressSchema,
  services: z.array(ServiceDefinitionWireSchema),
  message_type: z.literal("service_catalog").optional(),
  timestamp: ISOTimestampSchema.optional(),
});

/**
 * Schema for ServiceCatalog with snake_case -> camelCase transform.
 *
 * Input: Wire-format JSON with snake_case fields.
 * Output: camelCase TypeScript object.
 *
 * Reuses transformServiceDefinition to avoid duplicating
 * the per-service transform logic.
 */
export const ServiceCatalogSchema = ServiceCatalogWireSchema.transform(
  (data) => ({
    protocol: data.protocol,
    provider: data.provider,
    walletAddress: data.wallet_address,
    services: data.services.map(transformServiceDefinition),
    messageType: data.message_type,
    timestamp: data.timestamp,
  }),
);

// ---------------------------------------------------------------------------
// ClientAgent (nested within ServiceRequest)
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for client agent identification.
 */
const ClientAgentWireSchema = z.object({
  name: z.string().min(1),
  wallet_address: HexAddressSchema,
  contact_endpoint: z.string().url().optional(),
});

/** Transform wire-format client agent to camelCase. */
function transformClientAgent(
  data: z.output<typeof ClientAgentWireSchema>,
) {
  return {
    name: data.name,
    walletAddress: data.wallet_address,
    contactEndpoint: data.contact_endpoint,
  };
}

/**
 * Schema for client agent with snake_case -> camelCase transform.
 */
export const ClientAgentSchema =
  ClientAgentWireSchema.transform(transformClientAgent);

// ---------------------------------------------------------------------------
// ServiceRequestDetails (nested within ServiceRequest)
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for service request details.
 */
const ServiceRequestDetailsWireSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1),
  budget_usdc: z.number().positive(),
  delivery_format: DeliveryFormatSchema.optional(),
  deadline: ISOTimestampSchema.optional(),
});

/** Transform wire-format service request details to camelCase. */
function transformServiceRequestDetails(
  data: z.output<typeof ServiceRequestDetailsWireSchema>,
) {
  return {
    type: data.type,
    description: data.description,
    budgetUsdc: data.budget_usdc,
    deliveryFormat: data.delivery_format,
    deadline: data.deadline,
  };
}

/**
 * Schema for service request details with snake_case -> camelCase transform.
 */
export const ServiceRequestDetailsSchema =
  ServiceRequestDetailsWireSchema.transform(transformServiceRequestDetails);

// ---------------------------------------------------------------------------
// ServiceRequest - POST /ivxp/request body
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for ServiceRequest messages.
 */
const ServiceRequestWireSchema = z.object({
  protocol: ProtocolVersionSchema,
  message_type: z.literal("service_request"),
  timestamp: ISOTimestampSchema,
  client_agent: ClientAgentWireSchema,
  service_request: ServiceRequestDetailsWireSchema,
});

/**
 * Schema for ServiceRequest with snake_case -> camelCase transform.
 *
 * Input: Wire-format JSON with snake_case fields.
 * Output: camelCase TypeScript object.
 *
 * Reuses transformClientAgent and transformServiceRequestDetails
 * to avoid duplicating transform logic.
 */
export const ServiceRequestSchema = ServiceRequestWireSchema.transform(
  (data) => ({
    protocol: data.protocol,
    messageType: data.message_type,
    timestamp: data.timestamp,
    clientAgent: transformClientAgent(data.client_agent),
    serviceRequest: transformServiceRequestDetails(data.service_request),
  }),
);

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

/** Inferred type from ServiceCatalogSchema output. */
export type ServiceCatalogOutput = z.infer<typeof ServiceCatalogSchema>;

/** Inferred type from ServiceRequestSchema output. */
export type ServiceRequestOutput = z.infer<typeof ServiceRequestSchema>;

/** Inferred type from ServiceDefinitionSchema output. */
export type ServiceDefinitionOutput = z.infer<typeof ServiceDefinitionSchema>;

/** Inferred type from ClientAgentSchema output. */
export type ClientAgentOutput = z.infer<typeof ClientAgentSchema>;
