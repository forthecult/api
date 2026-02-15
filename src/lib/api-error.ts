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

import { createId } from "@paralleldrive/cuid2";
import { NextResponse } from "next/server";

export type ApiErrorCode =
  // Product errors
  | "CATEGORY_NOT_FOUND"
  | "DATABASE_ERROR"
  | "EMPTY_CART"
  | "FORBIDDEN"
  | "INSUFFICIENT_STOCK"
  // Category errors
  | "INTERNAL_ERROR"
  // Order errors
  | "INVALID_ADDRESS"
  | "INVALID_CART"
  | "INVALID_EMAIL"
  | "INVALID_PHONE"
  // Checkout errors
  | "INVALID_REQUEST"
  | "MISSING_REQUIRED_FIELD"
  | "NOT_FOUND"
  | "ORDER_ALREADY_PAID"
  | "ORDER_CANCELLED"
  | "ORDER_EXPIRED"
  | "ORDER_NOT_FOUND"
  // Validation errors
  | "PAYMENT_EXPIRED"
  | "PAYMENT_FAILED"
  | "PAYMENT_METHOD_UNSUPPORTED"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_UNAVAILABLE"
  // Auth errors
  | "RATE_LIMIT_EXCEEDED"
  | "SERVICE_UNAVAILABLE"
  // Generic resource not found
  | "SHIPPING_REQUIRED"
  // Rate limiting
  | "SHIPPING_UNAVAILABLE"
  // Server errors
  | "UNAUTHORIZED"
  | "VARIANT_NOT_FOUND"
  | "VARIANT_REQUIRED";

interface ApiErrorDetails {
  code: ApiErrorCode;
  httpStatus: number;
  message: string;
  suggestions?: string[];
}

/**
 * Error code definitions with messages and suggestions
 */
const ERROR_DEFINITIONS: Record<ApiErrorCode, Omit<ApiErrorDetails, "code">> = {
  // Category errors
  CATEGORY_NOT_FOUND: {
    httpStatus: 404,
    message: "The requested category does not exist.",
    suggestions: [
      "List all categories: GET /api/categories",
      "Check the category ID or slug is correct",
    ],
  },
  DATABASE_ERROR: {
    httpStatus: 500,
    message: "A database error occurred. Please try again.",
    suggestions: [
      "Retry your request",
      "If the problem persists, contact support with the requestId",
    ],
  },
  EMPTY_CART: {
    httpStatus: 400,
    message: "Cannot checkout with an empty cart.",
    suggestions: [
      "Add items to your request",
      "Search for products: POST /api/products/search",
    ],
  },
  FORBIDDEN: {
    httpStatus: 403,
    message: "You do not have permission to access this resource.",
    suggestions: [
      "Check your API key permissions",
      "Contact support if you believe this is an error",
    ],
  },
  INSUFFICIENT_STOCK: {
    httpStatus: 400,
    message: "Not enough stock available for the requested quantity.",
    suggestions: [
      "Reduce the quantity",
      "Check current stock: GET /api/products/{slug}",
    ],
  },

  // Server errors
  INTERNAL_ERROR: {
    httpStatus: 500,
    message: "An unexpected error occurred. Please try again.",
    suggestions: [
      "Retry your request",
      "If the problem persists, contact support with the requestId",
    ],
  },

  INVALID_ADDRESS: {
    httpStatus: 400,
    message: "The provided address is invalid or incomplete.",
    suggestions: [
      "Include: name, address1, city, stateCode, zip, countryCode",
      "Use ISO 2-letter country codes (US, GB, CA, etc.)",
    ],
  },
  // Checkout errors
  INVALID_CART: {
    httpStatus: 400,
    message: "The cart contains invalid items.",
    suggestions: [
      "Verify all product IDs exist",
      "Check quantities are positive integers",
    ],
  },
  INVALID_EMAIL: {
    httpStatus: 400,
    message: "The provided email address is invalid.",
    suggestions: ["Provide a valid email format: user@example.com"],
  },
  INVALID_PHONE: {
    httpStatus: 400,
    message: "The provided phone number is invalid.",
    suggestions: ["Provide phone in international format: +1234567890"],
  },

  // Validation errors
  INVALID_REQUEST: {
    httpStatus: 400,
    message: "The request body is invalid or malformed.",
    suggestions: [
      "Check the request format matches the API documentation",
      "Ensure all required fields are present",
    ],
  },
  MISSING_REQUIRED_FIELD: {
    httpStatus: 400,
    message: "A required field is missing from the request.",
    suggestions: ["Check the API documentation for required fields"],
  },
  NOT_FOUND: {
    httpStatus: 404,
    message: "The requested resource was not found.",
    suggestions: ["Verify the resource ID or path is correct"],
  },
  ORDER_ALREADY_PAID: {
    httpStatus: 400,
    message: "This order has already been paid.",
    suggestions: [
      "Check order status: GET /api/orders/{orderId}/status",
      "View order details: GET /api/orders/{orderId}",
    ],
  },
  ORDER_CANCELLED: {
    httpStatus: 400,
    message: "This order has been cancelled.",
    suggestions: ["Create a new order: POST /api/checkout"],
  },
  ORDER_EXPIRED: {
    httpStatus: 400,
    message: "This order has expired. Payment window has closed.",
    suggestions: [
      "Create a new order: POST /api/checkout",
      "Orders expire 1 hour after creation",
    ],
  },
  // Order errors
  ORDER_NOT_FOUND: {
    httpStatus: 404,
    message: "The requested order does not exist.",
    suggestions: [
      "Verify the order ID is correct",
      "Create a new order: POST /api/checkout",
    ],
  },

  PAYMENT_EXPIRED: {
    httpStatus: 400,
    message: "The payment window has expired.",
    suggestions: [
      "Create a new order: POST /api/checkout",
      "Payment windows are typically 1 hour",
    ],
  },
  PAYMENT_FAILED: {
    httpStatus: 400,
    message: "Payment could not be processed.",
    suggestions: [
      "Verify sufficient balance in wallet",
      "Check the transaction was sent to the correct address",
      "Try again: POST /api/checkout",
    ],
  },
  PAYMENT_METHOD_UNSUPPORTED: {
    httpStatus: 400,
    message: "The requested payment method is not supported.",
    suggestions: [
      "Check supported payment methods: GET /api/chains",
      "Supported: SOL, USDC, ETH, USDT on various chains",
    ],
  },
  // Product errors
  PRODUCT_NOT_FOUND: {
    httpStatus: 404,
    message: "The requested product does not exist or is not published.",
    suggestions: [
      "Verify the product ID is correct",
      "Search for products: POST /api/products/search",
      "Browse categories: GET /api/categories",
    ],
  },
  PRODUCT_UNAVAILABLE: {
    httpStatus: 400,
    message: "This product is currently unavailable for purchase.",
    suggestions: [
      "Check product availability: GET /api/products/{productId}",
      "Search for similar products: POST /api/products/search",
    ],
  },

  // Rate limiting
  RATE_LIMIT_EXCEEDED: {
    httpStatus: 429,
    message: "Too many requests. Please slow down.",
    suggestions: [
      "Wait before retrying (see Retry-After header)",
      "Reduce request frequency",
      "Contact support for higher limits",
    ],
  },
  SERVICE_UNAVAILABLE: {
    httpStatus: 503,
    message: "The service is temporarily unavailable.",
    suggestions: [
      "Wait a few minutes and retry",
      "Check GET /api/health for service status",
    ],
  },

  SHIPPING_REQUIRED: {
    httpStatus: 400,
    message: "Shipping address is required for physical products.",
    suggestions: [
      "Include shipping object with: name, address1, city, stateCode, zip, countryCode",
    ],
  },

  SHIPPING_UNAVAILABLE: {
    httpStatus: 400,
    message: "We cannot ship to the specified address.",
    suggestions: [
      "Check supported countries: GET /api/agent/capabilities",
      "Verify the country code is correct (ISO 2-letter)",
    ],
  },

  // Auth errors
  UNAUTHORIZED: {
    httpStatus: 401,
    message: "Authentication required.",
    suggestions: ["Include Authorization header: Bearer YOUR_API_KEY"],
  },
  VARIANT_NOT_FOUND: {
    httpStatus: 404,
    message: "The requested product variant does not exist.",
    suggestions: [
      "Get available variants: GET /api/products/{productId}",
      "Check the variantId is correct",
    ],
  },
  VARIANT_REQUIRED: {
    httpStatus: 400,
    message: "This product has variants. Please specify a variantId.",
    suggestions: [
      "Get available variants: GET /api/products/{slug}/variants",
      "Include variantId in your request",
    ],
  },
};

export interface ApiError {
  error: {
    _suggestions: string[];
    code: ApiErrorCode;
    details?: Record<string, unknown>;
    message: string;
    requestId: string;
    timestamp: string;
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
      _suggestions: definition.suggestions || [],
      requestId,
      timestamp: new Date().toISOString(),
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

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
