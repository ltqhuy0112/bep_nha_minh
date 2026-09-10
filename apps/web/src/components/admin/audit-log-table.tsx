import type { AdminAuditLogList } from "@bep-nha-minh/api/services/admin-audit-logs";
import { formatDateTime } from "@/lib/admin/format";

export function AuditLogTable({
  logs
}: {
  logs: AdminAuditLogList["items"];
}) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-olive-700/20 bg-white p-8 text-center text-muted">
        Chưa có audit log phù hợp với bộ lọc.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-olive-700/10 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <thead className="bg-beige-200/50 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-olive-700/10">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-4 text-muted">{formatDateTime(log.createdAt)}</td>
                <td className="px-4 py-4">
                  <p className="font-semibold text-olive-900">
                    {log.actorName ?? "System"}
                  </p>
                  <p className="text-xs text-muted">{log.actorEmail ?? "-"}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-olive-700/10 px-3 py-1 text-xs font-bold text-olive-900">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-4 text-muted">
                  <p className="font-semibold text-olive-900">{log.entityType}</p>
                  <p className="max-w-[220px] truncate text-xs">{log.entityId ?? "-"}</p>
                </td>
                <td className="px-4 py-4 text-muted">{log.ipAddress ?? "-"}</td>
                <td className="px-4 py-4">
                  <pre className="max-h-28 max-w-[360px] overflow-auto rounded-lg bg-olive-900 p-3 text-xs leading-5 text-cream-100">
                    {formatMetadata(log.metadata)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatMetadata(metadata: unknown) {
  if (!metadata) {
    return "{}";
  }

  return JSON.stringify(metadata, null, 2);
}
