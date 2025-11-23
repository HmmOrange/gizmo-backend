import {
    AzureKeyCredential,
    TextAnalysisClient
} from "@azure/ai-language-text";

const endpoint = process.env.AZURE_LANGUAGE_ENDPOINT;
const apiKey = process.env.AZURE_LANGUAGE_KEY;

const client = new TextAnalysisClient(endpoint, new AzureKeyCredential(apiKey));

export async function summarizeText(text) {
    console.log("Input Text:", text);  // Kiểm tra giá trị text

    if (!text || typeof text !== "string") {
        throw new Error("Invalid text input");
    }

    const documents = [{ id: "1", text: text }];
    console.log("Documents to send:", JSON.stringify(documents, null, 2)); // Log documents dưới dạng JSON

    try {
        const actions = [
            {
                kind: "ExtractiveSummarization",
                maxSentenceCount: 2,
            },
        ];
        const poller = await client.beginAnalyzeBatch(actions, documents, "en");

        poller.onProgress(() => {
            const state = poller.getOperationState();
            console.log(`Current status: ${state.status}`);
            if (state.status === "failed") {
                console.error("Operation failed.");
                return;
            }
            console.log(
                `Last time the operation was updated was on: ${state.modifiedOn}`
            );
        });

        console.log(`The operation was created on ${poller.getOperationState().createdOn}`);
        console.log(`The operation results will expire on ${poller.getOperationState().expiresOn}`);

        const results = await poller.pollUntilDone();

        for await (const actionResult of results) {
            if (actionResult.kind !== "ExtractiveSummarization") {
                throw new Error(`Expected extractive summarization results but got: ${actionResult.kind}`);
            }
            if (actionResult.error) {
                const { code, message } = actionResult.error;
                throw new Error(`Unexpected error (${code}): ${message}`);
            }
            for (const result of actionResult.results) {
                console.log(`- Document ${result.id}`);
                if (result.error) {
                    const { code, message } = result.error;
                    throw new Error(`Unexpected error (${code}): ${message}`);
                }
                if (result.sentences && result.sentences.length > 0) {
                    var summary = result.sentences.map((sentence) => sentence.text).join("\n");
                    console.log("Summary:");
                    console.log(summary);
                } else {
                    console.log("No summary generated for this document.");
                }
            }
        }
        return summary;

    } catch (err) {
        console.error("AZURE SUMMARY ERROR:", err);
        throw new Error("Failed to summarize text");
    }
}

