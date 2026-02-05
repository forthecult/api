/**
 * Standardized API Error Handling for AI-Friendly Responses
 *
 * Every error response follows this format:
 * {
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Human-readable message",
 *     "details": { ... },
 *     "requestId": "req_xxx",
 *     "timestamp": "ISO-8601",
 *     "_suggestions": ["Helpful next steps for AI agents"]
 *   }
 * }
 */

import { NextResponse } from "next/server";
import { createId } from "@paralleldrive/cuid2";

export type ApiErrorCode =
  // Product errors
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_UNAVAILABLE"
  | "INSUFFICIENT_STOCK"
  | "VARIANT_NOT_FOUND"
  | "VARIANT_REQUIRED"
  // Category errors
  | "CATEGORY_NOT_FOUND"
  // Order errors
  | "ORDER_NOT_FOUND"
  | "ORDER_EXPIRED"
  | "ORDER_ALREADY_PAID"
  | "ORDER_CANCELLED"
  // Checkout errors
  | "INVALID_CART"
  | "EMPTY_CART"
  | "SHIPPING_REQUIRED"
  | "SHIPPING_UNAVAILABLE"
  | "PAYMENT_METHOD_UNSUPPORTED"
  | "PAYMENT_FAILED"
  | "PAYMENT_EXPIRED"
  // Validation errors
  | "INVALID_REQUEST"
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_EMAIL"
  | "INVALID_PHONE"
  | "INVALID_ADDRESS"
  // Auth errors
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  // Rate limiting
  | "RATE_LIMIT_EXCEEDED"
  // Server errors
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "DATABASE_ERROR";

interface ApiErrorDetails {
  code: ApiErrorCode;
  message: string;
  httpStatus: number;
  suggestions?: string[];
}

/**
 * Error code definitions with messages and suggestions
 */
const ERROR_DEFINITIONS: Record<ApiErrorCode, Omit<ApiErrorDetails, "code">> = {
  // Product errors
  PRODUCT_NOT_FOUND: {
    message: "The requested product does not exist or is not published.",
    httpStatus: 404,
    suggestions: [
      "Verify the product ID is correct",
      "Search for products: POST /api/products/search",
      "Browse categories: GET /api/categories",
    ],
  },
  PRODUCT_UNAVAILABLE: {
    message: "This product is currently unavailable for purchase.",
    httpStatus: 400,
    suggestions: [
      "Check product availability: GET /api/products/{productId}",
      "Search for similar products: POST /api/products/search",
    ],
  },
  INSUFFICIENT_STOCK: {
    message: "Not enough stock available for the requested quantity.",
    httpStatus: 400,
    suggestions: [
      "Reduce the quantity",
      "Check current stock: GET /api/products/{slug}",
    ],
  },
  VARIANT_NOT_FOUND: {
    message: "The requested product variant does not exist.",
    httpStatus: 404,
    suggestions: [
      "Get available variants: GET /api/products/{productId}",
      "Check the variantId is correct",
    ],
  },
  VARIANT_REQUIRED: {
    message: "This product has variants. Please specify a variantId.",
    httpStatus: 400,
    suggestions: [
      "Get available variants: GET /api/products/{slug}/variants",
      "Include variantId in your request",
    ],
  },

  // Category errors
  CATEGORY_NOT_FOUND: {
    message: "The requested category does not exist.",
    httpStatus: 404,
    suggestions: [
      "List all categories: GET /api/categories",
      "Check the category ID or slug is correct",
    ],
  },

  // Order errors
  ORDER_NOT_FOUND: {
    message: "The requested order does not exist.",
    httpStatus: 404,
    suggestions: [
      "Verify the order ID is correct",
      "Create a new order: POST /api/checkout",
    ],
  },
  ORDER_EXPIRED: {
    message: "This order has expired. Payment window has closed.",
    httpStatus: 400,
    suggestions: [
      "Create a new order: POST /api/checkout",
      "Orders expire 1 hour after creation",
    ],
  },
  ORDER_ALREADY_PAID: {
    message: "This order has already been paid.",
    httpStatus: 400,
    suggestions: [
      "Check order status: GET /api/orders/{orderId}/status",
      "View order details: GET /api/orders/{orderId}",
    ],
  },
  ORDER_CANCELLED: {
    message: "This order has been cancelled.",
    httpStatus: 400,
    suggestions: ["Create a new order: POST /api/checkout"],
  },

  // Checkout errors
  INVALID_CART: {
    message: "The cart contains invalid items.",
    httpStatus: 400,
    suggestions: [
      "Verify all product IDs exist",
      "Check quantities are positive integers",
    ],
  },
  EMPTY_CART: {
    message: "Cannot checkout with an empty cart.",
    httpStatus: 400,
    suggestions: [
      "Add items to your request",
      "Search for products: POST /api/products/search",
    ],
  },
  SHIPPING_REQUIRED: {
    message: "Shipping address is required for physical products.",
    httpStatus: 400,
    suggestions: [
      "Include shipping object with: name, address1, city, stateCode, zip, countryCode",
    ],
  },
  SHIPPING_UNAVAILABLE: {
    message: "We cannot ship to the specified address.",
    httpStatus: 400,
    suggestions: [
      "Check supported countries: GET /api/agent/capabilities",
      "Verify the country code is correct (ISO 2-letter)",
    ],
  },
  PAYMENT_METHOD_UNSUPPORTED: {
    message: "The requested payment method is not supported.",
    httpStatus: 400,
    suggestions: [
      "Check supported payment methods: GET /api/chains",
      "Supported: SOL, USDC, ETH, USDT on various chains",
    ],
  },
  PAYMENT_FAILED: {
    message: "Payment could not be processed.",
    httpStatus: 400,
    suggestions: [
      "Verify sufficient balance in wallet",
      "Check the transaction was sent to the correct address",
      "Try again: POST /api/checkout",
    ],
  },
  PAYMENT_EXPIRED: {
    message: "The payment window has expired.",
    httpStatus: 400,
    suggestions: [
      "Create a new order: POST /api/checkout",
      "Payment windows are typically 1 hour",
    ],
  },

  // Validation errors
  INVALID_REQUEST: {
    message: "The request body is invalid or malformed.",
    httpStatus: 400,
    suggestions: [
      "Check the request format matches the API documentation",
      "Ensure all required fields are present",
    ],
  },
  MISSING_REQUIRED_FIELD: {
    message: "A required field is missing from the request.",
    httpStatus: 400,
    suggestions: ["Check the API documentation for required fields"],
  },
  INVALID_EMAIL: {
    message: "The provided email address is invalid.",
    httpStatus: 400,
    suggestions: ["Provide a valid email format: user@example.com"],
  },
  INVALID_PHONE: {
    message: "The provided phone number is invalid.",
    httpStatus: 400,
    suggestions: ["Provide phone in international format: +1234567890"],
  },
  INVALID_ADDRESS: {
    message: "The provided address is invalid or incomplete.",
    httpStatus: 400,
    suggestions: [
      "Include: name, address1, city, stateCode, zip, countryCode",
      "Use ISO 2-letter country codes (US, GB, CA, etc.)",
    ],
  },

  // Auth errors
  UNAUTHORIZED: {
    message: "Authentication required.",
    httpStatus: 401,
    suggestions: ["Include Authorization header: Bearer YOUR_API_KEY"],
  },
  FORBIDDEN: {
    message: "You do not have permission to access this resource.",
    httpStatus: 403,
    suggestions: [
      "Check your API key permissions",
      "Contact support if you believe this is an error",
    ],
  },

  // Rate limiting
  RATE_LIMIT_EXCEEDED: {
    message: "Too many requests. Please slow down.",
    httpStatus: 429,
    suggestions: [
      "Wait before retrying (see Retry-After header)",
      "Reduce request frequency",
      "Contact support for higher limits",
    ],
  },

  // Server errors
  INTERNAL_ERROR: {
    message: "An unexpected error occurred. Please try again.",
    httpStatus: 500,
    suggestions: [
      "Retry your request",
      "If the problem persists, contact support with the requestId",
    ],
  },
  SERVICE_UNAVAILABLE: {
    message: "The service is temporarily unavailable.",
    httpStatus: 503,
    suggestions: [
      "Wait a few minutes and retry",
      "Check GET /api/health for service status",
    ],
  },
  DATABASE_ERROR: {
    message: "A database error occurred. Please try again.",
    httpStatus: 500,
    suggestions: [
      "Retry your request",
      "If the problem persists, contact support with the requestId",
    ],
  },
};

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
    timestamp: string;
    _suggestions: string[];
  };
}

/**
 * Create a standardized API error response
 */
export function apiError(
  code: ApiErrorCode,
  details?: Record<string, unknown>,
  customMessage?: string,
): NextResponse<ApiError> {
  const definition = ERROR_DEFINITIONS[code];
  const requestId = `req_${createId()}`;

  const errorResponse: ApiError = {
    error: {
      code,
      message: customMessage || definition.message,
      ...(details && Object.keys(details).length > 0 && { details }),
      requestId,
      timestamp: new Date().toISOString(),
      _suggestions: definition.suggestions || [],
    },
  };

  return NextResponse.json(errorResponse, { status: definition.httpStatus });
}

/**
 * Create error from caught exception
 */
export function apiErrorFromException(
  err: unknown,
  fallbackCode: ApiErrorCode = "INTERNAL_ERROR",
): NextResponse<ApiError> {
  console.error("API Error:", err);

  // Check for known error types
  if (err instanceof Error) {
    // Database errors
    if (
      err.message.includes("relation") ||
      err.message.includes("does not exist")
    ) {
      return apiError("DATABASE_ERROR", { originalError: err.message });
    }
  }

  return apiError(fallbackCode);
}

/**
 * Validation helper - returns error response if validation fails
 */
export function validateRequired(
  body: Record<string, unknown>,
  fields: string[],
): NextResponse<ApiError> | null {
  const missing = fields.filter(
    (f) => body[f] === undefined || body[f] === null || body[f] === "",
  );

  if (missing.length > 0) {
    return apiError(
      "MISSING_REQUIRED_FIELD",
      {
        missingFields: missing,
      },
      `Missing required field(s): ${missing.join(", ")}`,
    );
  }

  return null;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Simple success response helper with consistent structure
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * Success with _actions helper for AI agents
 */
export function apiSuccessWithActions<T>(
  data: T,
  actions: Record<string, string>,
  status = 200,
): NextResponse<T & { _actions: Record<string, string> }> {
  return NextResponse.json({ ...data, _actions: actions }, { status });
}
