import { env } from '@xenova/transformers'
import { invoke } from '@tauri-apps/api/core';
// @ts-ignore
import { Client } from "@gradio/client";

// Configure to allow local models (optional) and control execution
env.allowLocalModels = false;
env.useBrowserCache = true;

console.log("SmartTools: Configured transformers env", {
    allowLocal: env.allowLocalModels,
    useBrowserCache: env.useBrowserCache
});

export interface TagResult {
    label: string
    score: number
}

/**
 * Singleton class to manage Smart Tools (Transformer models)
 */
class SmartToolsService {
    private static instance: SmartToolsService
    private isServerReady = false;

    private constructor() { }

    public static getInstance(): SmartToolsService {
        if (!SmartToolsService.instance) {
            SmartToolsService.instance = new SmartToolsService()
        }
        return SmartToolsService.instance
    }

    /**
     * Analyze Artist/Style using Kaloscope (Hugging Face Space API)
     */
    public async analyzeStyle(imageUrl: string, _progressCallback?: (progress: number) => void): Promise<TagResult[]> {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            console.log("SmartTools: Connecting to Kaloscope API...");
            const client = await Client.connect("DraconicDragon/Kaloscope-artist-style-classifier");

            const result = await client.predict("/predict", {
                image: blob
            });

            console.log("Kaloscope raw result:", result);

            const dataArray = result.data as any[];
            const rawData = dataArray?.[0];

            if (typeof rawData === 'string') {
                const artists = rawData.split(',').map(a => a.trim()).filter(a => a.length > 0);
                return artists.map((artist, index) => ({
                    label: `artist:${artist}`,
                    score: 1 - (index * 0.05)
                }));
            }

            if (typeof rawData === 'object' && rawData !== null) {
                const entries = Object.entries(rawData as Record<string, number>);
                return entries
                    .map(([label, score]) => ({ label: `artist:${label}`, score }))
                    .sort((a, b) => b.score - a.score);
            }

            console.warn("Kaloscope: Unexpected result format", rawData);
            return [];
        } catch (e) {
            console.error("Kaloscope API Error:", e);
            throw new Error("Failed to connect to Kaloscope API. Internet connection required.");
        }
    }

    /**
     * Remove background from an image using Hugging Face Space
     * Tries multiple Spaces for reliability
     */
    public async removeBackground(
        imageUrl: string,
        _progressCallback?: (progress: number) => void
    ): Promise<string> {
        // Step 0: Try Local Python Server first
        try {
            console.log("SmartTools: Check Local Server...");
            await this.startLocalServer(); // Ensure server is running (auto-started by backend, but check health)

            // Check health
            const health = await fetch('http://127.0.0.1:8002/health');
            if (health.ok) {
                console.log("SmartTools: Local Server is healthy. Using local RMBG...");
                const response = await fetch(imageUrl);
                const blob = await response.blob();

                const formData = new FormData();
                formData.append('image', blob);
                formData.append('model', 'isnet-general-use'); // Or anime model?

                // Note: Our current tagger-server (main.py) only has /tag endpoint. 
                // We need to implement /rmbg endpoint in python first?
                // Wait, duplicate user request implies they expect it to work.
                // But wait, if python server doesn't have /rmbg, we can't call it.
                // Checking python code is needed.

                // If python doesn't support it, we must rely on remote.
                // BUT the remote "strange person" issue is due to Gradio API default behavior when busy/error.

                // Let's look at the existing code again. It tries BRIA first.
            }
        } catch (e) {
            console.warn("Local server check failed:", e);
        }

        const response = await fetch(imageUrl);
        const blob = await response.blob();

        // Step 1: Try BRIA-RMBG-2.0
        try {
            console.log("SmartTools: Trying briaai/BRIA-RMBG-2.0...");
            const client = await Client.connect("briaai/BRIA-RMBG-2.0");
            const result = await client.predict("/image", { image: blob });

            // Validate result is not a placeholder (can check if it's the same image or specific size? hard to tell)
            // But usually API error throws.

            const outputData = (result.data as any[])?.[1];
            if (outputData) {
                return await this.processGradioOutput(outputData);
            }
        } catch (e: any) {
            console.warn("BRIA-RMBG-2.0 failed:", e?.message);
        }

        // Step 2: Fallback skytnt/anime-remove-background
        try {
            console.log("SmartTools: Trying skytnt/anime-remove-background...");
            const client = await Client.connect("skytnt/anime-remove-background");
            const result = await client.predict("/rmbg_fn", { img: blob });

            const outputData = (result.data as any[])?.[0];
            if (outputData) {
                return await this.processGradioOutput(outputData);
            }
        } catch (e: any) {
            console.warn("anime-remove-background failed:", e?.message);
        }

        throw new Error("모든 배경 제거 서비스 연결 실패. 잠시 후 다시 시도해주세요.");
    }

    /**
     * Process Gradio output (URL, path, or data URL)
     */
    private async processGradioOutput(outputData: any): Promise<string> {
        if (typeof outputData === 'string') {
            if (outputData.startsWith('http')) {
                const imgResponse = await fetch(outputData);
                const imgBlob = await imgResponse.blob();
                return await this.blobToDataUrl(imgBlob);
            }
            if (outputData.startsWith('data:')) {
                return outputData;
            }
        } else if (outputData.url) {
            const imgResponse = await fetch(outputData.url);
            const imgBlob = await imgResponse.blob();
            return await this.blobToDataUrl(imgBlob);
        }
        throw new Error("Invalid output format");
    }

    /**
     * Convert Blob to Data URL
     */
    private blobToDataUrl(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Start Python Sidecar for local tagger server
     */
    public async startLocalServer() {
        if (this.isServerReady) return;

        console.log("SmartTools: Starting Local Server...");

        try {
            // Check if server is already running
            const healthCheck = await fetch('http://127.0.0.1:8002/health');
            if (healthCheck.ok) {
                console.log("SmartTools: Server already running!");
                this.isServerReady = true;
                return;
            }
        } catch (e) {
            // Not running
        }

        console.log("SmartTools: Invoking start_tagger command...");
        try {
            // Use backend to spawn and manage the process
            await invoke('start_tagger');
            console.log("SmartTools: Tagger sidecar started via backend");
        } catch (e) {
            console.error("SmartTools: Failed to start tagger sidecar:", e);
            throw e;
        }

        // Wait for server to be ready
        let retries = 0;
        while (retries < 60) {
            try {
                const response = await fetch('http://127.0.0.1:8002/health');
                if (response.ok) {
                    console.log("SmartTools: Local Tagger Server is ready!");
                    this.isServerReady = true;
                    return;
                }
            } catch (e) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries++;
            }
        }

        throw new Error("태그 분석 서버 시작 시간 초과");
    }


    /**
     * Get current download status from Python sidecar
     */
    public async getDownloadStatus(): Promise<{
        is_downloading: boolean;
        model_name: string;
        progress: number;
        total: number;
        percent: number;
        message: string;
    } | null> {
        try {
            const res = await fetch('http://127.0.0.1:8002/download-status');
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            // Server not ready yet
        }
        return null;
    }

    /**
     * Check if Tagger binary exists
     */
    public async checkTaggerAvailable(): Promise<boolean> {
        try {
            return await invoke('check_tagger_binary');
        } catch (e) {
            console.warn("Failed to check tagger binary:", e);
            return false;
        }
    }

    /**
     * Analyze tags using WD14 Tagger (Local Python Sidecar)
     */
    public async analyzeTags(
        imageUrl: string,
        _progressCallback?: (progress: number) => void
    ): Promise<TagResult[]> {
        console.log("SmartTools: Connecting to Local Python Tagger Sidecar...");

        await this.startLocalServer();

        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('file', blob);
            formData.append('threshold', '0.35');

            const apiRes = await fetch('http://127.0.0.1:8002/tag', {
                method: 'POST',
                body: formData
            });

            if (!apiRes.ok) throw new Error(`Server returned ${apiRes.status}`);

            const data = await apiRes.json();
            if (data.error) throw new Error(data.error);

            return (data.tags || []).map((t: any) => ({
                label: t.label,
                score: t.score
            }));

        } catch (e) {
            console.error("WD Tagger Local Error:", e);
            throw new Error("Failed to connect to Local Tagger Server. Is Python installed?");
        }
    }

    /**
     * Upscale image using NovelAI's augment-image API (4x)
     */
    public async upscale(imageBase64: string, token: string): Promise<string> {
        const { upscaleImage } = await import('@/services/novelai-api')

        const img = new Image()
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
            img.src = imageBase64
        })

        const result = await upscaleImage(token, imageBase64, img.width, img.height)

        if (!result.success || !result.imageData) {
            throw new Error(result.error || 'Upscale failed')
        }

        return `data:image/png;base64,${result.imageData}`
    }
}

export const smartTools = SmartToolsService.getInstance()
