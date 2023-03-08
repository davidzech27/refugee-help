import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  REDIS_URL: z.string(),
  REDIS_TOKEN: z.string(),
  PINECONE_API_KEY: z.string(),
  PINECONE_ENVIRONMENT: z.string(),
  PINECONE_INDEX: z.string(),
  OPENAI_SECRET_KEY: z.string(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables: ",
    JSON.stringify(parsed.error.format(), null, 4)
  );
  process.exit(1);
}

export default parsed.data;
