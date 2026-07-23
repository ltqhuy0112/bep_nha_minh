import { adminAuthErrorResponse, requireSession } from "@/lib/admin/session";
import { successResponse } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession({ redirectToLogin: false });

    return successResponse({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        permissions: session.user.permissions
      }
    });
  } catch (error) {
    const response = adminAuthErrorResponse(error);
    if (response) {
      return response;
    }

    throw error;
  }
}
