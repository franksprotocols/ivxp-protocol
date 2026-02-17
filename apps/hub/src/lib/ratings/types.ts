// Wire-format types (snake_case for JSON serialization)

/** Valid star rating values */
export type Stars = 1 | 2 | 3 | 4 | 5;

/** A rating record stored in the registry (wire format) */
export interface RatingWire {
  readonly rating_id: string;
  readonly order_id: string;
  readonly provider_address: string;
  readonly service_type: string;
  readonly client_address: string;
  readonly stars: Stars;
  readonly review_text?: string;
  readonly signature: string;
  readonly created_at: number;
}

/** Request body for submitting a rating */
export interface SubmitRatingRequestWire {
  readonly order_id: string;
  readonly stars: Stars;
  readonly review_text?: string;
  readonly signature: string;
}

/** Successful rating submission response */
export interface SubmitRatingResponseWire {
  readonly success: true;
  readonly rating_id: string;
}

/** Rating error response */
export interface RatingErrorResponseWire {
  readonly error: {
    readonly code: RatingErrorCode;
    readonly message: string;
    readonly details?: Record<string, string[]>;
  };
}

/** Known error codes for rating operations */
export type RatingErrorCode =
  | "ORDER_NOT_FOUND"
  | "ORDER_NOT_DELIVERED"
  | "INVALID_SIGNATURE"
  | "DUPLICATE_RATING"
  | "INVALID_PARAMETERS"
  | "INVALID_JSON"
  | "INTERNAL_ERROR"
  | "RATE_LIMITED"
  | "TIMESTAMP_EXPIRED";
