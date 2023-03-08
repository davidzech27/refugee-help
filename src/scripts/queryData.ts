import { OpenAIApi, Configuration, ChatCompletionRequestMessage } from "openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { env } from "~/env.mjs";
import readline from "readline";
import type { PineconeVector } from "./indexData";

const REPHRASE_QUERY = true;

const main = async () => {
  let query = "";

  process.stdout.write("Query: ");

  const lines = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  for await (const line of lines) {
    query = line;
    break;
  }

  const openai = new OpenAIApi(
    new Configuration({
      apiKey: env.OPENAI_SECRET_KEY,
    })
  );

  REPHRASE_QUERY &&
    (query = (
      await openai.createChatCompletion({
        messages: [
          {
            role: "system",
            content:
              "Rephrase upon the following question express the user's intent in a clearer manner. Add additional content if necessary to improve the quality and completeness of the question.",
          },
          { role: "user", content: query },
        ],
        model: "gpt-3.5-turbo",
        temperature: 0,
      })
    ).data.choices[0]!.message!.content);

  const promptBuilder = ({
    information,
    context,
  }: {
    information: string[];
    context: {};
  }) => `You are a very knowledgeable assistant to people with questions about the process of finding asylum in Europe. Based on some background information, you will answer users' questions.

  Background information: ${information.map(
    (info, infoIndex) =>
      `${info}${infoIndex === information.length - 1 ? "" : "/n"}`
  )}`; // consider appending Before answering, internally rephrase the question to be clearer if necessary.

  const pinecone = new PineconeClient();

  await pinecone.init({
    environment: env.PINECONE_ENVIRONMENT,
    apiKey: env.PINECONE_API_KEY,
  });

  const index = pinecone.Index(env.PINECONE_INDEX);

  const category = "asylumineurope" satisfies "asylumineurope" | "uscis";

  const embedding = (
    await openai.createEmbedding({
      input: query,
      model: "text-embedding-ada-002",
    })
  ).data.data[0]!.embedding;

  const { matches } = await index.query({
    queryRequest: {
      topK: 5,
      includeMetadata: true,
      namespace: category,
      vector: embedding,
    },
  });

  const information = matches!.map(
    (match) => (match.metadata as PineconeVector["metadata"]).text
  );

  const prompt = promptBuilder({ information, context: {} });

  const messages: ChatCompletionRequestMessage[] = [
    { role: "system", content: prompt },
    { role: "user", content: query },
  ];

  const completion = (
    await openai.createChatCompletion({
      messages,
      model: "gpt-3.5-turbo",
      temperature: 0,
    })
  ).data.choices[0]!.message!.content;

  console.info("Prompt: " + prompt);
  console.info();
  console.info("Query: " + query);
  console.info();
  console.info("Completion: " + completion);
};

main();
