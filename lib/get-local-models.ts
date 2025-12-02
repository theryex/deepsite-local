// lib/get-local-models.ts
// 🛠️ FIX: Define Model type locally to resolve Type error: Module '"@/types"' has no exported member 'Model'.

// This type must be fully defined to match what the app expects for models
type Model = {
    value: string;
    label: string;
    id: string;
    providers: string[];
    companyName: string;
    logo?: any;
    top_k?: number;
    temperature?: number;
    top_p?: number;
};

// 🛠️ CRITICAL FIX: Replaced 'host.docker.internal' with the static IP
const VLLM_URL = 'http://192.168.76.96:8000/v1/models';
const OLLAMA_URL = 'http://192.168.76.96:11434/api/tags';

export async function getVLLMModels(): Promise<Model[]> {
    try {
        console.log(`[getVLLMModels] Fetching from ${VLLM_URL}`);
        const res = await fetch(VLLM_URL, {
            headers: { 'accept': 'application/json' },
            cache: 'no-store'
        });

        console.log(`[getVLLMModels] Status: ${res.status}`);

        if (!res.ok) {
             // 🛠️ Log network failure for debugging
             console.error(`vLLM failed with status: ${res.status}. Check if vLLM is running and firewall is open on 192.168.76.96:8000.`);
             return [];
        }

        const data = await res.json();
        // console.log(`[getVLLMModels] Data:`, JSON.stringify(data));

        // vLLM returns a list of models in 'data' array with 'id' property.
        return data.data.map((m: any) => ({
            value: m.id,
            label: `vLLM (Running: ${m.id})`,
            id: 'local-vllm',
            providers: [],
            companyName: 'Local Host',
        }));
    } catch (error) {
        console.error("Failed to fetch models from vLLM:", error);
        return [];
    }
}

export async function getOllamaModels(): Promise<Model[]> {
    try {
        console.log(`[getOllamaModels] Fetching from ${OLLAMA_URL}`);
        const res = await fetch(OLLAMA_URL, {
            headers: { 'accept': 'application/json' },
            cache: 'no-store'
        });

        console.log(`[getOllamaModels] Status: ${res.status}`);

        if (!res.ok) {
             // 🛠️ Log network failure for debugging
             console.error(`Ollama failed with status: ${res.status}. Check if Ollama is running and firewall is open on 192.168.76.96:11434.`);
             return [];
        }

        const data = await res.json();
        console.log(`[getOllamaModels] Data models count:`, data.models?.length);

        // Ollama returns a list in 'models' array with 'name' property.
        return data.models.map((m: any) => ({
            // Ollama model names often contain the version (e.g., 'llama3:8b').
            value: m.name,
            label: `Ollama (Running: ${m.name.split(':')[0]})`,
            id: 'local-ollama',
            providers: [],
            companyName: 'Local Host',
        }));
    } catch (error) {
        console.error("Failed to fetch models from Ollama:", error);
        return [];
    }
}
