import type { AdminWaitlistList } from "@/services/admin-waitlist";
import { formatDateTime } from "@/lib/admin/format";

export function WaitlistTable({
  leads
}: {
  leads: AdminWaitlistList["items"];
}) {
  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-olive-700/20 bg-white p-8 text-center text-muted">
        Chưa có người ghi danh phù hợp với bộ lọc.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-olive-700/10 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-beige-200/50 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Người ghi danh</th>
              <th className="px-4 py-3">Liên hệ</th>
              <th className="px-4 py-3">Khu vực</th>
              <th className="px-4 py-3">Bữa ăn</th>
              <th className="px-4 py-3">Nguồn</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Ngày tạo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-olive-700/10">
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className="px-4 py-4 font-bold text-olive-900">{lead.name}</td>
                <td className="px-4 py-4 text-muted">
                  <p>{lead.phone ?? "-"}</p>
                  <p className="text-xs">{lead.email ?? "-"}</p>
                </td>
                <td className="px-4 py-4 text-muted">{lead.district}</td>
                <td className="px-4 py-4">{lead.preferredMeal ?? "-"}</td>
                <td className="px-4 py-4 text-muted">{lead.source}</td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-olive-700/10 px-3 py-1 text-xs font-bold uppercase text-olive-900">
                    {lead.status}
                  </span>
                </td>
                <td className="px-4 py-4 text-muted">{formatDateTime(lead.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
