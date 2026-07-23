import "server-only";
import { query } from "@/db/client";

export type SiteContentRecord = {
  section_key: string;
  content_json: unknown;
};

export async function getPublishedSiteContent() {
  const result = await query<SiteContentRecord>(
    `
      SELECT section_key, content_json
      FROM site_content
      WHERE is_published = true
      ORDER BY section_key ASC
    `
  );

  return result.rows;
}
