import {
    openApiSource,
    protocolSource,
    specificationSource,
    providerSource,
    userSource,
    sdkSource,
} from "@/lib/source";
import { getLLMText } from "@/lib/get-llm-text";

// Cache forever — content only changes on rebuild
export const revalidate = false;

export async function GET() {
    const allPages = [
        ...specificationSource.getPages(),
        ...protocolSource.getPages(),
        ...providerSource.getPages(),
        ...userSource.getPages(),
        ...sdkSource.getPages(),
        ...openApiSource.getPages(),
    ];

    const texts = await Promise.all(allPages.map(getLLMText));
    return new Response(texts.join("\n\n---\n\n"), {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
        },
    });
}
