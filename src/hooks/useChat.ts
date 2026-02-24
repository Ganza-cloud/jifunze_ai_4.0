import { useState, useCallback } from 'react';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

const STARTER_PROMPTS = [
    "Explain the basic concept",
    "Give me a real-world example",
    "How does this relate to previous topics?",
    "Create a practice problem"
];

const MOCK_RESPONSES = [
    "That's a great question! Let's break it down...",
    "Think of it this way: imagine you're driving a car...",
    "Here's a simple example to illustrate that point...",
    "In the context of this subject, this concept is crucial because..."
];

export function useChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = useCallback(async (content: string) => {
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        // Simulate network delay
        setTimeout(() => {
            const randomResponse = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: randomResponse + " (This is a mock AI response)",
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, aiMessage]);
            setIsLoading(false);
        }, 1500);
    }, []);

    return {
        messages,
        isLoading,
        sendMessage,
        starterPrompts: STARTER_PROMPTS
    };
}
