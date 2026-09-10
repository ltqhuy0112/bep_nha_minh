import { orderStatuses } from "@bep-nha-minh/shared/constants/order-status";
import { brandName, siteUrl } from "@bep-nha-minh/api/lib/site";

type Schema = Record<string, unknown>;

const isoDateTime = {
  type: "string",
  format: "date-time",
  example: "2026-07-23T10:30:00.000Z"
} satisfies Schema;

const uuid = {
  type: "string",
  format: "uuid"
} satisfies Schema;

const date = {
  type: "string",
  format: "date",
  example: "2026-07-23"
} satisfies Schema;

const nullableString = {
  type: ["string", "null"]
} satisfies Schema;

const pagination = {
  type: "object",
  required: ["page", "pageSize", "totalItems", "totalPages"],
  properties: {
    page: { type: "integer", minimum: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 100 },
    totalItems: { type: "integer", minimum: 0 },
    totalPages: { type: "integer", minimum: 0 }
  }
} satisfies Schema;

const errorResponse = {
  type: "object",
  required: ["success", "error"],
  properties: {
    success: { type: "boolean", const: false },
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: {
          type: "object",
          additionalProperties: { type: "string" }
        }
      }
    }
  }
} satisfies Schema;

const successResponse = (data: Schema) =>
  ({
    type: "object",
    required: ["success", "data"],
    properties: {
      success: { type: "boolean", const: true },
      data,
      message: { type: "string" }
    }
  }) satisfies Schema;

const jsonResponse = (description: string, schema: Schema) => ({
  description,
  content: {
    "application/json": {
      schema
    }
  }
});

const errorResponses = {
  "400": jsonResponse("Validation or JSON parsing error.", errorResponse),
  "401": jsonResponse("Admin session is missing or expired.", errorResponse),
  "403": jsonResponse("Admin user does not have the required permission.", errorResponse),
  "404": jsonResponse("The requested resource was not found.", errorResponse),
  "409": jsonResponse("The requested mutation conflicts with current state.", errorResponse),
  "422": jsonResponse("The resource cannot be processed in its current shape.", errorResponse),
  "500": jsonResponse("Unexpected server error.", errorResponse)
};

const orderStatus = {
  type: "string",
  enum: orderStatuses
} satisfies Schema;

const customerSummary = {
  type: "object",
  required: ["id", "fullName", "phone", "email"],
  properties: {
    id: uuid,
    fullName: { type: "string" },
    phone: nullableString,
    email: nullableString
  }
} satisfies Schema;

const orderListItem = {
  type: "object",
  required: [
    "id",
    "orderCode",
    "status",
    "fulfillmentType",
    "deliveryDate",
    "deliveryTimeSlot",
    "totalAmount",
    "currency",
    "createdAt",
    "updatedAt",
    "customer"
  ],
  properties: {
    id: uuid,
    orderCode: { type: "string", example: "BNM-260723-001" },
    status: orderStatus,
    fulfillmentType: { type: "string", enum: ["DELIVERY", "PICKUP"] },
    deliveryDate: { ...date, type: ["string", "null"] },
    deliveryTimeSlot: nullableString,
    totalAmount: { type: "number", minimum: 0 },
    currency: { type: "string", example: "VND" },
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
    customer: customerSummary
  }
} satisfies Schema;

const orderDetail = {
  allOf: [
    orderListItem,
    {
      type: "object",
      required: ["customerNote", "internalNote", "items", "pricing", "approvals", "statusHistory"],
      properties: {
        customerNote: nullableString,
        internalNote: nullableString,
        customer: {
          type: "object",
          required: ["id", "fullName", "phone", "email", "addressLine", "ward", "district", "city", "notes"],
          properties: {
            id: uuid,
            fullName: { type: "string" },
            phone: nullableString,
            email: nullableString,
            addressLine: nullableString,
            ward: nullableString,
            district: nullableString,
            city: nullableString,
            notes: nullableString
          }
        },
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "itemName", "itemSnapshot", "quantity", "unitPrice", "lineTotal", "createdAt"],
            properties: {
              id: uuid,
              itemName: { type: "string" },
              itemSnapshot: { type: "object", additionalProperties: true },
              quantity: { type: "integer", minimum: 1 },
              unitPrice: { type: "number", minimum: 0 },
              lineTotal: { type: "number", minimum: 0 },
              createdAt: isoDateTime
            }
          }
        },
        pricing: {
          type: "object",
          required: ["subtotalAmount", "deliveryFee", "discountAmount", "totalAmount"],
          properties: {
            subtotalAmount: { type: "number", minimum: 0 },
            deliveryFee: { type: "number", minimum: 0 },
            discountAmount: { type: "number", minimum: 0 },
            totalAmount: { type: "number", minimum: 0 }
          }
        },
        approvals: {
          type: "object",
          additionalProperties: true
        },
        statusHistory: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "fromStatus", "toStatus", "reason", "changedBy", "createdAt"],
            properties: {
              id: uuid,
              fromStatus: { ...orderStatus, type: ["string", "null"] },
              toStatus: orderStatus,
              reason: nullableString,
              changedBy: {
                type: ["object", "null"],
                properties: {
                  id: uuid,
                  name: nullableString,
                  email: nullableString
                }
              },
              createdAt: isoDateTime
            }
          }
        }
      }
    }
  ]
} satisfies Schema;

const listQueryParameters = [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
  { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
  { name: "search", in: "query", schema: { type: "string", maxLength: 120 } },
  { name: "dateFrom", in: "query", schema: date },
  { name: "dateTo", in: "query", schema: date }
];

const reasonRequest = {
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["reason"],
        properties: {
          reason: { type: "string", minLength: 3, maxLength: 1000 }
        }
      }
    }
  }
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: `${brandName} API`,
    version: "1.0.0",
    description:
      "OpenAPI documentation for public waitlist endpoints and protected admin operations."
  },
  servers: [{ url: siteUrl }],
  tags: [
    { name: "Public", description: "Public website endpoints." },
    { name: "Admin Auth", description: "Protected admin session endpoints." },
    { name: "Admin Orders", description: "Protected order operations." },
    { name: "Admin Customers", description: "Protected customer operations." },
    { name: "Admin Analytics", description: "Protected analytics endpoints." }
  ],
  components: {
    securitySchemes: {
      adminSession: {
        type: "apiKey",
        in: "cookie",
        name: "authjs.session-token",
        description: "NextAuth admin session cookie."
      }
    },
    schemas: {
      ErrorResponse: errorResponse,
      Pagination: pagination,
      OrderStatus: orderStatus,
      OrderListItem: orderListItem,
      OrderDetail: orderDetail
    }
  },
  paths: {
    "/api/health": {
      get: {
        tags: ["Public"],
        summary: "Check service and database health.",
        responses: {
          "200": jsonResponse(
            "Service is healthy.",
            successResponse({
              type: "object",
              required: ["status", "database"],
              properties: {
                status: { type: "string", enum: ["ok"] },
                database: { type: "string", enum: ["connected"] }
              }
            })
          ),
          "503": jsonResponse("Service is unavailable.", errorResponse)
        }
      }
    },
    "/api/site-content": {
      get: {
        tags: ["Public"],
        summary: "Load published website content sections.",
        responses: {
          "200": jsonResponse(
            "Published site content.",
            successResponse({
              type: "object",
              required: ["sections"],
              properties: {
                sections: {
                  type: "object",
                  additionalProperties: true
                }
              }
            })
          ),
          "500": errorResponses["500"]
        }
      }
    },
    "/api/waitlist": {
      post: {
        tags: ["Public"],
        summary: "Submit a waitlist lead for opening notifications.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "district"],
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 120 },
                  phone: { type: "string", maxLength: 30 },
                  email: { type: "string", format: "email", maxLength: 255 },
                  district: { type: "string", minLength: 1, maxLength: 120 },
                  preferredMeal: { type: "string", maxLength: 80 },
                  source: { type: "string", maxLength: 80, default: "website" }
                },
                anyOf: [{ required: ["phone"] }, { required: ["email"] }]
              }
            }
          }
        },
        responses: {
          "201": jsonResponse(
            "Waitlist lead was created.",
            successResponse({
              type: "object",
              required: ["id", "status", "createdAt"],
              properties: {
                id: uuid,
                status: { type: "string", example: "NEW" },
                createdAt: isoDateTime
              }
            })
          ),
          "400": errorResponses["400"],
          "409": errorResponses["409"],
          "500": errorResponses["500"]
        }
      }
    },
    "/api/admin/session": {
      get: {
        tags: ["Admin Auth"],
        summary: "Return the current admin session user.",
        security: [{ adminSession: [] }],
        responses: {
          "200": jsonResponse(
            "Current admin user.",
            successResponse({
              type: "object",
              required: ["user"],
              properties: {
                user: {
                  type: "object",
                  required: ["id", "email", "name", "role", "permissions"],
                  properties: {
                    id: uuid,
                    email: { type: "string", format: "email" },
                    name: { type: "string" },
                    role: { type: "string" },
                    permissions: { type: "array", items: { type: "string" } }
                  }
                }
              }
            })
          ),
          "401": errorResponses["401"]
        }
      }
    },
    "/api/admin/orders": {
      get: {
        tags: ["Admin Orders"],
        summary: "List orders for the admin table.",
        security: [{ adminSession: [] }],
        parameters: [
          ...listQueryParameters,
          { name: "status", in: "query", schema: orderStatus },
          { name: "customerId", in: "query", schema: uuid },
          {
            name: "sortBy",
            in: "query",
            schema: {
              type: "string",
              enum: ["createdAt", "deliveryDate", "orderCode", "status", "totalAmount"],
              default: "createdAt"
            }
          },
          {
            name: "sortDirection",
            in: "query",
            schema: { type: "string", enum: ["asc", "desc"], default: "desc" }
          }
        ],
        responses: {
          "200": jsonResponse(
            "Order list.",
            successResponse({
              type: "object",
              required: ["items", "pagination"],
              properties: {
                items: { type: "array", items: orderListItem },
                pagination
              }
            })
          ),
          "400": errorResponses["400"],
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "500": errorResponses["500"]
        }
      }
    },
    "/api/admin/orders/{orderId}": {
      get: {
        tags: ["Admin Orders"],
        summary: "Get one order detail.",
        security: [{ adminSession: [] }],
        parameters: [{ name: "orderId", in: "path", required: true, schema: uuid }],
        responses: {
          "200": jsonResponse("Order detail.", successResponse({ type: "object", required: ["order"], properties: { order: orderDetail } })),
          "400": errorResponses["400"],
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "404": errorResponses["404"],
          "500": errorResponses["500"]
        }
      }
    },
    "/api/admin/orders/{orderId}/approve": {
      post: {
        tags: ["Admin Orders"],
        summary: "Approve a pending order.",
        security: [{ adminSession: [] }],
        parameters: [{ name: "orderId", in: "path", required: true, schema: uuid }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  internalNote: { type: "string", maxLength: 1000 }
                }
              }
            }
          }
        },
        responses: {
          "200": jsonResponse("Approved order.", successResponse({ type: "object", required: ["order"], properties: { order: orderDetail } })),
          "400": errorResponses["400"],
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "404": errorResponses["404"],
          "409": errorResponses["409"],
          "422": errorResponses["422"],
          "500": errorResponses["500"]
        }
      }
    },
    "/api/admin/orders/{orderId}/reject": {
      post: {
        tags: ["Admin Orders"],
        summary: "Reject a pending order with a reason.",
        security: [{ adminSession: [] }],
        parameters: [{ name: "orderId", in: "path", required: true, schema: uuid }],
        requestBody: reasonRequest,
        responses: {
          "200": jsonResponse("Rejected order.", successResponse({ type: "object", required: ["order"], properties: { order: orderDetail } })),
          "400": errorResponses["400"],
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "404": errorResponses["404"],
          "409": errorResponses["409"],
          "500": errorResponses["500"]
        }
      }
    },
    "/api/admin/orders/{orderId}/cancel": {
      post: {
        tags: ["Admin Orders"],
        summary: "Cancel an order with a reason.",
        security: [{ adminSession: [] }],
        parameters: [{ name: "orderId", in: "path", required: true, schema: uuid }],
        requestBody: reasonRequest,
        responses: {
          "200": jsonResponse("Cancelled order.", successResponse({ type: "object", required: ["order"], properties: { order: orderDetail } })),
          "400": errorResponses["400"],
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "404": errorResponses["404"],
          "409": errorResponses["409"],
          "500": errorResponses["500"]
        }
      }
    },
    "/api/admin/orders/{orderId}/status": {
      patch: {
        tags: ["Admin Orders"],
        summary: "Move an order through controlled non-terminal status transitions.",
        security: [{ adminSession: [] }],
        parameters: [{ name: "orderId", in: "path", required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: orderStatus,
                  reason: { type: "string", maxLength: 1000 }
                }
              }
            }
          }
        },
        responses: {
          "200": jsonResponse("Updated order.", successResponse({ type: "object", required: ["order"], properties: { order: orderDetail } })),
          "400": errorResponses["400"],
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "404": errorResponses["404"],
          "409": errorResponses["409"],
          "500": errorResponses["500"]
        }
      }
    },
    "/api/admin/customers": {
      get: {
        tags: ["Admin Customers"],
        summary: "List customers for the admin table.",
        security: [{ adminSession: [] }],
        parameters: listQueryParameters,
        responses: {
          "200": jsonResponse(
            "Customer list.",
            successResponse({
              type: "object",
              required: ["items", "pagination"],
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["id", "fullName", "phone", "email", "district", "city", "createdAt", "totalOrders", "completedValue", "latestOrderAt"],
                    properties: {
                      id: uuid,
                      fullName: { type: "string" },
                      phone: nullableString,
                      email: nullableString,
                      district: nullableString,
                      city: nullableString,
                      createdAt: isoDateTime,
                      totalOrders: { type: "integer", minimum: 0 },
                      completedValue: { type: "number", minimum: 0 },
                      latestOrderAt: { ...isoDateTime, type: ["string", "null"] }
                    }
                  }
                },
                pagination
              }
            })
          ),
          "400": errorResponses["400"],
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "500": errorResponses["500"]
        }
      }
    },
    "/api/admin/analytics/orders": {
      get: {
        tags: ["Admin Analytics"],
        summary: "Return order analytics summary and chart-ready time series.",
        security: [{ adminSession: [] }],
        parameters: [
          { name: "range", in: "query", schema: { type: "string", enum: ["1d", "3d", "7d"] } },
          { name: "dateFrom", in: "query", schema: date },
          { name: "dateTo", in: "query", schema: date }
        ],
        responses: {
          "200": jsonResponse(
            "Order analytics.",
            successResponse({
              type: "object",
              required: ["timezone", "mode", "bucketUnit", "range", "revenueStatuses", "summary", "series"],
              properties: {
                timezone: { type: "string", example: "Asia/Ho_Chi_Minh" },
                mode: { type: "string", enum: ["1d", "3d", "7d", "custom"] },
                bucketUnit: { type: "string", enum: ["hour", "day", "week", "month"] },
                range: {
                  type: "object",
                  required: ["dateFrom", "dateTo"],
                  properties: {
                    dateFrom: { ...date, type: ["string", "null"] },
                    dateTo: { ...date, type: ["string", "null"] }
                  }
                },
                revenueStatuses: { type: "array", items: orderStatus },
                summary: {
                  type: "object",
                  additionalProperties: { type: "number" }
                },
                series: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["bucket", "orderCount", "approvedCount", "completedCount", "grossRevenue"],
                    properties: {
                      bucket: { type: "string" },
                      orderCount: { type: "integer", minimum: 0 },
                      approvedCount: { type: "integer", minimum: 0 },
                      completedCount: { type: "integer", minimum: 0 },
                      grossRevenue: { type: "number", minimum: 0 }
                    }
                  }
                }
              }
            })
          ),
          "400": errorResponses["400"],
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "500": errorResponses["500"]
        }
      }
    },
    "/api/auth/{nextauth}": {
      get: {
        tags: ["Admin Auth"],
        summary: "NextAuth-managed auth endpoint.",
        description: "Catch-all endpoint handled by NextAuth. It powers sign-in, callbacks, CSRF, providers and session internals.",
        parameters: [{ name: "nextauth", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "NextAuth response." }
        }
      },
      post: {
        tags: ["Admin Auth"],
        summary: "NextAuth-managed auth endpoint.",
        description: "Catch-all endpoint handled by NextAuth. It powers sign-in, callbacks, CSRF, providers and session internals.",
        parameters: [{ name: "nextauth", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "NextAuth response." }
        }
      }
    }
  }
} as const;
