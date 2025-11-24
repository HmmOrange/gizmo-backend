import { ComputerVisionClient } from "@azure/cognitiveservices-computervision";
import { ApiKeyCredentials } from "@azure/ms-rest-js";
const key = process.env.AZURE_VISION_KEY;
const endpoint = process.env.AZURE_VISION_ENDPOINT;

const client = new ComputerVisionClient(
  new ApiKeyCredentials({ inHeader: { "Ocp-Apim-Subscription-Key": key } }),
  endpoint
);

// OCR buffer
export async function readImageOCR(buffer) {
  const result = await client.readInStream(buffer);
  const operationId = result.operationLocation.split("/").slice(-1)[0];

  let readResult;
  while (true) {
    readResult = await client.getReadResult(operationId);
    if (readResult.status !== "running") break;
    await new Promise(r => setTimeout(r, 1000));
  }

  if (readResult.status === "failed") return "";

  const lines = readResult.analyzeResult.readResults
    .flatMap(p => p.lines.map(l => l.text))
    .join("\n");

  return lines;
}
