"use client";
import React from "react";
import { FloatingNav } from "@/components/ui/floating-navbar";
import { IconHome, IconMessage, IconUser } from "@tabler/icons-react";
import { Book, Code, FileText, Layers, Terminal, Zap } from "lucide-react";

export default function DocsPage() {
    const navItems = [
        {
            name: "Home",
            link: "/",
            icon: <IconHome className="h-4 w-4 text-neutral-500 dark:text-white" />,
        },
        {
            name: "Chat",
            link: "/chat",
            icon: <IconMessage className="h-4 w-4 text-neutral-500 dark:text-white" />,
        },
        {
            name: "Docs",
            link: "/docs",
            icon: <IconUser className="h-4 w-4 text-neutral-500 dark:text-white" />,
        },
    ];

    return (
        <div className="min-h-screen bg-black/[0.96] antialiased bg-grid-white/[0.02] relative">
            <FloatingNav navItems={navItems} />

            <div className="pt-32 px-6 max-w-5xl mx-auto text-white pb-20">
                <div className="mb-16 text-center">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
                        Documentation
                    </h1>
                    <p className="text-neutral-300 max-w-2xl mx-auto text-lg">
                        Learn how to integrate, configure, and maximize the potential of your AI Agent.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {[
                        {
                            title: "Getting Started",
                            icon: <Zap className="w-6 h-6 text-yellow-400" />,
                            content: "Quick start guide to setting up your environment and running your first agent workflow."
                        },
                        {
                            title: "Architecture",
                            icon: <Layers className="w-6 h-6 text-blue-400" />,
                            content: "Deep dive into the RAG pipeline, WebSocket communication, and agent orchestration."
                        },
                        {
                            title: "API Reference",
                            icon: <Code className="w-6 h-6 text-green-400" />,
                            content: "Complete endpoint documentation for REST APIs and WebSocket events."
                        },
                        {
                            title: "MCP Tools",
                            icon: <Terminal className="w-6 h-6 text-purple-400" />,
                            content: "How to connect external tools using the Model Context Protocol standard."
                        },
                        {
                            title: "Knowledge Base",
                            icon: <Book className="w-6 h-6 text-red-400" />,
                            content: "Best practices for preparing and uploading documents for RAG analysis."
                        },
                        {
                            title: "Workflows",
                            icon: <FileText className="w-6 h-6 text-cyan-400" />,
                            content: "Creating and managing complex multi-step agent workflows."
                        }
                    ].map((item, i) => (
                        <div key={i} className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-2 rounded-lg bg-black/50 border border-white/10 group-hover:border-white/20 transition-colors">
                                    {item.icon}
                                </div>
                                <h2 className="text-xl font-semibold">{item.title}</h2>
                            </div>
                            <p className="text-gray-400 leading-relaxed">
                                {item.content}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
