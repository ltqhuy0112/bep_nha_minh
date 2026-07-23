"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getAllowedOrderTransitions, type OrderStatus } from "@/lib/order-status";
import { getOrderStatusLabel } from "@/components/admin/order-status-badge";

type ActionType = "approve" | "reject" | "cancel" | "status";

type DialogState =
  | { type: "approve" }
  | { type: "reject" }
  | { type: "cancel" }
  | { type: "status"; status: OrderStatus }
  | null;

export function OrderActions({
  orderId,
  status,
  permissions,
  compact = false
}: {
  orderId: string;
  status: OrderStatus;
  permissions: string[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextStatuses = useMemo(
    () =>
      getAllowedOrderTransitions(status).filter(
        (nextStatus) => nextStatus !== "REJECTED" && nextStatus !== "CANCELLED"
      ),
    [status]
  );

  async function submit(action: ActionType, body: Record<string, unknown>) {
    setError(null);
    setMessage(null);

    const endpoint =
      action === "status"
        ? `/api/admin/orders/${orderId}/status`
        : `/api/admin/orders/${orderId}/${action}`;
    const method = action === "status" ? "PATCH" : "POST";

    startTransition(async () => {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        error?: { message: string };
      };

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không thể cập nhật đơn hàng.");
        return;
      }

      setDialog(null);
      setMessage(payload.message ?? "Đơn hàng đã được cập nhật.");
      router.refresh();
    });
  }

  const buttonClass =
    "rounded-lg border border-olive-700/15 px-3 py-2 text-xs font-bold text-olive-900 transition hover:bg-olive-700/10 disabled:opacity-60";

  return (
    <div className="grid gap-2">
      <div className={`flex ${compact ? "flex-wrap" : "flex-wrap"} gap-2`}>
        {permissions.includes("orders.approve") && status === "PENDING" ? (
          <button className={buttonClass} type="button" onClick={() => setDialog({ type: "approve" })}>
            Duyệt
          </button>
        ) : null}
        {permissions.includes("orders.reject") && status === "PENDING" ? (
          <button className={buttonClass} type="button" onClick={() => setDialog({ type: "reject" })}>
            Từ chối
          </button>
        ) : null}
        {permissions.includes("orders.cancel") &&
        ["PENDING", "APPROVED", "PREPARING"].includes(status) ? (
          <button className={buttonClass} type="button" onClick={() => setDialog({ type: "cancel" })}>
            Hủy
          </button>
        ) : null}
        {permissions.includes("orders.update_status")
          ? nextStatuses.map((nextStatus) => (
              <button
                className={buttonClass}
                key={nextStatus}
                type="button"
                onClick={() => setDialog({ type: "status", status: nextStatus })}
              >
                {getOrderStatusLabel(nextStatus)}
              </button>
            ))
          : null}
      </div>
      {message ? <p className="text-xs font-semibold text-olive-700">{message}</p> : null}
      {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}
      {dialog ? (
        <OrderActionDialog
          dialog={dialog}
          pending={isPending}
          onClose={() => setDialog(null)}
          onSubmit={submit}
        />
      ) : null}
    </div>
  );
}

function OrderActionDialog({
  dialog,
  pending,
  onClose,
  onSubmit
}: {
  dialog: Exclude<DialogState, null>;
  pending: boolean;
  onClose: () => void;
  onSubmit: (action: ActionType, body: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState("");
  const needsReason = dialog.type === "reject" || dialog.type === "cancel";
  const title =
    dialog.type === "approve"
      ? "Duyệt đơn hàng"
      : dialog.type === "reject"
        ? "Từ chối đơn hàng"
        : dialog.type === "cancel"
          ? "Hủy đơn hàng"
          : `Chuyển sang ${getOrderStatusLabel(dialog.status)}`;

  function submit() {
    if (dialog.type === "approve") {
      onSubmit("approve", { internalNote: text || undefined });
      return;
    }

    if (dialog.type === "status") {
      onSubmit("status", { status: dialog.status, reason: text || undefined });
      return;
    }

    onSubmit(dialog.type, { reason: text });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-olive-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <h3 className="text-lg font-bold text-olive-900">{title}</h3>
        <label className="mt-4 grid gap-2 text-sm font-semibold text-olive-900">
          {needsReason ? "Lý do" : "Ghi chú nội bộ"}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            required={needsReason}
            rows={4}
            className="rounded-lg border border-olive-700/15 px-3 py-2 outline-none focus:border-olive-700"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-olive-700/15 px-4 py-2 text-sm font-bold"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={pending || (needsReason && text.trim().length < 3)}
            onClick={submit}
            className="rounded-lg bg-olive-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Đang xử lý..." : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}
