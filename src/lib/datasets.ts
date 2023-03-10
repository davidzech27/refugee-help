export type Dataset = "uscis" | "asylumineurope";

export const datasets = ["uscis", "asylumineurope"] as const;

export const datasetStartingLinks: Record<Dataset, string> = {
	uscis: "https://www.uscis.gov/humanitarian/refugees-and-asylum/asylum/obtaining-asylum-in-the-united-states",
	asylumineurope: "https://www.uscis.gov/sitemap",
};
