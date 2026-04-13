"use client";

import { buildApiInput } from '@/utils/tools/mapping';
import { findSettingByModelId } from "@/lib/ai-model-setting/modelSetting";

const POLL_INTERVAL = 3000; // 3s
const MAX_POLL_COUNT = 100;  // max 300s wait

export interface MidjourneyTaskResult {
    id: string;
    status: 'NOT_START' | 'SUBMITTED' | 'MODAL' | 'IN_PROGRESS' | 'FAILURE' | 'SUCCESS';
    progress: string;
    imageUrl?: string;
    buttons?: Array<{
        customId: string;
        label: string;
        emoji: string;
        style: number;
        type: number;
    }>;
    failReason?: string;
    prompt?: string;
    action?: string;
}

export interface MidjourneyGenerationResult {
    success: boolean;
    data: MidjourneyTaskResult | null;
    error: string | null;
}

// Submit Midjourney task
export async function submitMidjourneyTask(
    baseUrl: string,
    apiKey: string,
    model_id: string,
    data: any
): Promise<{ success: boolean; data: string | null; error: string | null }> {
    const setting = findSettingByModelId(model_id);
    if (!setting?.apiInput?.endpoint) {
        return { success: false, data: null, error: "Unsupported model" };
    }

    const endpoint = setting.apiInput.endpoint;
    const input = buildApiInput(setting.apiInput, data);

    try {
        const mode = model_id.includes('relax') ? 'relax' : 'fast';
        const url = `${baseUrl}/${mode}${endpoint}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(input)
        });

        const result = await response.json();

        if (result.code === 1 || result.code === 22) {
            return { success: true, data: String(result.result), error: null };
        } else {
            return { success: false, data: null, error: result.description || 'Submit failed' };
        }
    } catch (error: any) {
        return { success: false, data: null, error: error.message };
    }
}

// Poll Midjourney task status
export async function pollMidjourneyTask(
    baseUrl: string,
    apiKey: string,
    taskId: string,
    onProgress?: (progress: string) => void
): Promise<MidjourneyGenerationResult> {
    const mode = 'fast'; // or 'relax', use fast for polling
    const fetchUrl = `${baseUrl}/${mode}/mj/task/${taskId}/fetch`;

    for (let i = 0; i < MAX_POLL_COUNT; i++) {
        try {
            const response = await fetch(fetchUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (!response.ok) {
                return { success: false, data: null, error: result.failReason || 'Poll failed' };
            }

            // Call progress callback
            if (onProgress && result.progress) {
                onProgress(result.progress);
            }

            // Task completed
            if (result.status === 'SUCCESS') {
                return {
                    success: true,
                    data: {
                        id: result.id,
                        status: result.status,
                        progress: result.progress,
                        imageUrl: result.imageUrl,
                        buttons: result.buttons,
                        prompt: result.prompt,
                        action: result.action
                    },
                    error: null
                };
            }

            // Task failed
            if (result.status === 'FAILURE') {
                return { success: false, data: null, error: result.failReason || 'Task failed' };
            }

            // Still processing, wait and retry
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

        } catch (error: any) {
            return { success: false, data: null, error: error.message };
        }
    }

    return { success: false, data: null, error: 'Timeout: max poll count reached' };
}

// Upscale / Variation action
export async function submitMidjourneyAction(
    baseUrl: string,
    apiKey: string,
    taskId: string,
    customId: string
): Promise<{ success: boolean; data: string | null; error: string | null }> {
    try {
        const response = await fetch(`${baseUrl}/fast/mj/submit/action`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ taskId, customId })
        });

        const result = await response.json();

        if (result.code === 1) {
            return { success: true, data: String(result.result), error: null };
        }
        return { success: false, data: null, error: result.description || 'Action failed' };
    } catch (error: any) {
        return { success: false, data: null, error: error.message };
    }
}

// Main handler: submit + poll
export async function handleMidjourneyGeneration(
    baseUrl: string,
    apiKey: string,
    model_id: string,
    data: any,
    onProgress?: (progress: string) => void
): Promise<MidjourneyGenerationResult> {
    // Step 1: Submit task
    const submitResult = await submitMidjourneyTask(baseUrl, apiKey, model_id, data);

    if (!submitResult.success || !submitResult.data) {
        return { success: false, data: null, error: submitResult.error };
    }

    const taskId = submitResult.data;
    console.log('Midjourney task submitted:', taskId);

    // Step 2: Poll until complete
    return pollMidjourneyTask(baseUrl, apiKey, taskId, onProgress);
}

// Check if model is Midjourney type
export function isMidjourneyModel(model_id: string): boolean {
    return model_id.startsWith('midjourney-');
}