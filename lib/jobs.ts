export type JobRow = {
  id: string;
  source: string;
  title: string;
  company: string;
  url: string;
  location: string;
  category: string;
  published: string;
  jobType: string;
};

/** Remotive API */
export type RemotiveJob = {
  id: number;
  title: string;
  company_name: string;
  url: string;
  candidate_required_location?: string | null;
  job_type?: string;
  publication_date?: string;
  category?: string;
};

export function normalizeRemotive(j: RemotiveJob): JobRow {
  return {
    id: `remotive:${j.id}`,
    source: "Remotive",
    title: j.title,
    company: j.company_name,
    url: j.url,
    location: (j.candidate_required_location || "").trim() || "—",
    category: j.category || "—",
    published: j.publication_date != null ? String(j.publication_date) : "",
    jobType: j.job_type || "—",
  };
}

export function normalizeAdzuna(j: {
  id: string;
  title: string;
  redirect_url: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  category?: { label?: string };
  created?: string;
}): JobRow {
  return {
    id: `adzuna:${j.id}`,
    source: "Adzuna",
    title: j.title,
    company: j.company?.display_name || "—",
    url: j.redirect_url,
    location: j.location?.display_name || "—",
    category: j.category?.label || "—",
    published: j.created != null ? String(j.created) : "",
    jobType: "—",
  };
}

export function normalizeArbeitnow(j: {
  slug: string;
  title: string;
  company_name: string;
  url: string;
  location?: string;
  created_at?: string;
  job_types?: string[];
}): JobRow {
  const types = j.job_types?.length ? j.job_types.join(", ") : "—";
  return {
    id: `arbeitnow:${j.slug}`,
    source: "Arbeitnow",
    title: j.title,
    company: j.company_name,
    url: j.url,
    location: (j.location || "").trim() || "—",
    category: "—",
    published: j.created_at != null ? String(j.created_at) : "",
    jobType: types,
  };
}

export function normalizeJobicy(j: {
  id: number;
  jobTitle: string;
  companyName: string;
  url: string;
  jobGeo?: string;
  jobIndustry?: string;
  jobType?: string;
  pubDate?: string;
}): JobRow {
  return {
    id: `jobicy:${j.id}`,
    source: "Jobicy",
    title: j.jobTitle,
    company: j.companyName,
    url: j.url,
    location: (j.jobGeo || "").trim() || "—",
    category: j.jobIndustry || "—",
    published: j.pubDate != null ? String(j.pubDate) : "",
    jobType: j.jobType || "—",
  };
}

export function normalizeGreenhouse(
  board: string,
  j: {
    id: number;
    title: string;
    absolute_url: string;
    company_name?: string;
    location?: { name?: string };
    first_published?: string;
    metadata?: Array<{ name?: string; value?: string }> | null;
  },
): JobRow {
  const metaDept = j.metadata?.find((m) => m.name === "Department");
  return {
    id: `greenhouse:${board}:${j.id}`,
    source: `Greenhouse (${board})`,
    title: j.title,
    company: j.company_name || board,
    url: j.absolute_url,
    location: j.location?.name || "—",
    category: metaDept?.value || "—",
    published: j.first_published != null ? String(j.first_published) : "",
    jobType: "—",
  };
}

export function normalizeAshby(
  org: string,
  j: {
    id: string;
    title: string;
    jobUrl: string;
    department?: string;
    team?: string;
    employmentType?: string;
    publishedAt?: string;
    workplaceType?: string;
    location?: string;
    isRemote?: boolean;
  },
): JobRow {
  const loc =
    j.location ||
    (j.isRemote ? "Remote" : "") ||
    (j.workplaceType ? String(j.workplaceType) : "") ||
    "—";
  return {
    id: `ashby:${org}:${j.id}`,
    source: `Ashby (${org})`,
    title: j.title,
    company: org,
    url: j.jobUrl,
    location: loc,
    category: j.team || j.department || "—",
    published: j.publishedAt != null ? String(j.publishedAt) : "",
    jobType: j.employmentType || "—",
  };
}

export type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  categories?: { commitment?: string; location?: string; team?: string };
  workplaceType?: string;
};

export function normalizeLever(site: string, p: LeverPosting): JobRow {
  const loc = p.categories?.location || p.workplaceType || "—";
  const team = p.categories?.team || "—";
  const jobType = p.categories?.commitment || "—";
  return {
    id: `lever:${site}:${p.id}`,
    source: `Lever (${site})`,
    title: p.text,
    company: site,
    url: p.hostedUrl,
    location: loc,
    category: team,
    published: "",
    jobType,
  };
}
