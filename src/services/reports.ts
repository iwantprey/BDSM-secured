export interface ApiReport {
  id: string;
  status: string;
  priority: string;
  location: string;
  description: string;
  created_at: string;
}

export async function fetchReports(signal?: AbortSignal): Promise<ApiReport[]> {
  const response = await fetch("/api/reports?limit=50", { signal });
  if (!response.ok) throw new Error(`Could not load reports (${response.status})`);
  const payload: { data: ApiReport[] } = await response.json();
  return payload.data;
}
