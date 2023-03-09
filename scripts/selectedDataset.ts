import { z } from "zod";
import { datasets } from "~/lib/datasets";

const schema = z.enum(datasets);

const parsed = schema.safeParse(process.env.SELECTED_DATASET);

if (!parsed.success) {
	console.error(parsed.error);
	process.exit(1);
}

export default parsed.data;
