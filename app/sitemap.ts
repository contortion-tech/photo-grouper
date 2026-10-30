import type { MetadataRoute } from "next";
import { SITE_URL } from "@/utils/site";
import { WORKFLOW_CONFIGS } from "@/utils/workflows";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
    ...WORKFLOW_CONFIGS.map((workflow) => ({
      url: `${SITE_URL}/${workflow.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
