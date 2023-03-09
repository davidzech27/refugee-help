import { z } from "zod";
import { datasets } from "~/lib/datasets";

const schema = z.enum(datasets);

const parsed = schema.safeParse(schema);

if (!parsed.success) {
	console.error(parsed.error);
	process.exit(1);
}

export default parsed.data;
