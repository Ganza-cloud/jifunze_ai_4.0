import { LlamaParseReader } from "@llamaindex/cloud/reader";
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

export async function extractMarkdownFromPdf(file: File): Promise<string> {
    if (!process.env.LLAMA_CLOUD_API_KEY) {
        throw new Error("LLAMA_CLOUD_API_KEY is not set in environment variables.");
    }

    const reader = new LlamaParseReader({ resultType: "markdown" });

    // Convert the File object to a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save it temporarily to disk since LlamaParseReader expects a file path
    const tempFilePath = path.join(os.tmpdir(), `upload-${Date.now()}-${file.name}`);
    await fs.writeFile(tempFilePath, buffer);

    try {
        const documents = await reader.loadData(tempFilePath);

        // Ensure documents is returned and map the text
        if (!documents || documents.length === 0) {
            console.warn("LlamaParseReader returned no documents.");
            return "";
        }

        return documents.map((doc: any) => doc.text).join('\n\n');
    } catch (error) {
        console.error("Error during LlamaParse extraction:", error);
        throw error;
    } finally {
        // Always clean up the temp file
        await fs.unlink(tempFilePath).catch((err) => {
            console.warn("Failed to clean up temp file:", tempFilePath, err);
        });
    }
}
