import type { Client } from "pg";

export const approvedFulfillmentSlots = [
  { key: "LUNCH_1", start: "10:30:00", end: "12:00:00" },
  { key: "LUNCH_2", start: "12:00:00", end: "13:30:00" },
  { key: "DINNER_1", start: "17:00:00", end: "18:30:00" },
  { key: "DINNER_2", start: "18:30:00", end: "20:00:00" }
] as const;

// Caller owns the transaction; serialize configuration writes without blocking catalog reads.
export async function configureApprovedFulfillmentSlots(client: Client) {
  await client.query("LOCK TABLE fulfillment_slots IN SHARE ROW EXCLUSIVE MODE");
  let inserted = 0;
  for (const [index, slot] of approvedFulfillmentSlots.entries()) {
    const existing = await client.query<{ matches: boolean }>(`
      SELECT start_local_time = $2::time AND end_local_time = $3::time
        AND timezone = 'Asia/Ho_Chi_Minh' AND cutoff_minutes = 120 AS matches
      FROM fulfillment_slots WHERE slot_key = $1`, [slot.key, slot.start, slot.end]);
    if (existing.rows.length) {
      if (!existing.rows[0].matches) {
        throw new Error(`Conflicting schedule for ${slot.key}; use a newly approved key instead of changing its meaning.`);
      }
      continue;
    }
    await client.query(`INSERT INTO fulfillment_slots
      (slot_key,label,start_local_time,end_local_time,timezone,cutoff_minutes,enabled,sort_order)
      VALUES ($1,$1,$2,$3,'Asia/Ho_Chi_Minh',120,true,$4)`,
    [slot.key, slot.start, slot.end, index + 1]);
    inserted++;
  }
  return inserted;
}
