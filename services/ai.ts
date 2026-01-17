import { api } from './api';

// This service handles interactions with your AI backend (e.g. OpenAI wrapper)

export const AIService = {
    /**
     * Sends a prompt to the AI and gets a response.
     * @param prompt The user's question or command.
     * @returns The AI's text response.
     */
    askCortex: async (prompt: string) => {
        // IN PRODUCTION: Uncomment this to hit your real backend
        /*
        const response = await api.post('/ai/chat', { prompt });
        return response.data.message; 
        */

        // FOR NOW: Simulating a "Live" connection to a powerful LLM
        // This 'mock' needs to be replaced with your actual OpenAI/Gemini endpoint call.

        console.log(`[Cortex AI] Sending to Neural Net: ${prompt}`);

        await new Promise(r => setTimeout(r, 1500)); // Network latency simulation

        // Fallback logic for demo (remove this when you have a real URL)
        const lower = prompt.toLowerCase();
        if (lower.includes('revenue')) return "Based on real-time transaction ledgers, today's revenue is ₦14,240,500. This is a 12% increase from yesterday. Top performing channel: Mobile App Transfers.";
        if (lower.includes('security') || lower.includes('threat')) return "Scanning system logs... No active intrusions detected. Firewall is active. 2Failed login attempts blocked in the last hour from IP 192.168.x.x.";
        if (lower.includes('user') || lower.includes('growth')) return "We acquired 450 new users in the last 24 hours. Retention rate is holding steady at 68%. Churn risk detected in the 'Student' segment.";

        return "I have analyzed your request against the database. The system is operating within normal parameters. Is there specific data you need regarding Operations, Finance, or Security?";
    }
};
