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

// IMPORTANT: These URLs use 'host.docker.internal' to access your host machine
const VLLM_URL = 'http://host.docker.internal:8000/v1/models';
// 🛠️ Ollama uses /api/tags directly, not /v1/models. This is corrected below.
const OLLAMA_URL = 'http://host.docker.internal:11434/api/tags';

export async function getVLLMModels(): Promise<Model[]> {
    try {
        const res = await fetch(VLLM_URL, {
            headers: { 'accept': 'application/json' },
            cache: 'no-store'
        });
        
        if (!res.ok) {
             console.error(`vLLM failed with status: ${res.status}`);
             return [];
        }
        
        const data = await res.json();
        
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
        const res = await fetch(OLLAMA_URL, {
            headers: { 'accept': 'application/json' },
            cache: 'no-store'
        });
        
        if (!res.ok) {
             console.error(`Ollama failed with status: ${res.status}`);
             return [];
        }

        const data = await res.json();

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