/**
 * Landing page - Home page for DosiBridge Agent
 */
"use client";

import React from "react";
import { Vortex } from "@/components/ui/vortex";
import { FlipWords } from "@/components/ui/flip-words";
import { FloatingNav } from "@/components/ui/floating-navbar";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { EvervaultCard, Icon } from "@/components/ui/evervault-card";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { IconHome, IconMessage, IconUser } from "@tabler/icons-react";
import Link from "next/link";

export default function Home() {
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

  const words = ["Intelligent", "Autonomous", "Creative", "Secure"];

  const features = [
    {
      quote: "Interact with intelligent AI agents that can use tools, access external APIs, and perform complex tasks.",
      name: "AI Agent Mode",
      title: "Tool Integration",
    },
    {
      quote: "Upload your documents and ask questions. Get accurate answers based on your document content using RAG technology.",
      name: "RAG Analysis",
      title: "Document Intelligence",
    },
    {
      quote: "Real-time streaming responses, WebSocket health monitoring, and optimized performance for the best experience.",
      name: "Lightning Fast",
      title: "Performance",
    },
    {
      quote: "Your data is encrypted and private. Each user's documents and sessions are completely isolated.",
      name: "Secure & Private",
      title: "Enterprise Grade",
    },
  ];

  return (
    <div className="min-h-screen bg-black overflow-x-hidden">
      <FloatingNav navItems={navItems} />

      {/* Hero Section with Vortex */}
      <div className="w-[calc(100%-4rem)] mx-auto rounded-md  h-[40rem] overflow-hidden">
        <Vortex
          backgroundColor="black"
          className="flex items-center flex-col justify-center px-2 md:px-10 py-4 w-full h-full"
        >
          <h2 className="text-white text-2xl md:text-6xl font-bold text-center">
            Your <FlipWords words={words} /> <br /> AI Assistant
          </h2>
          <p className="text-white text-sm md:text-2xl max-w-xl mt-6 text-center">
            Powered by advanced AI agents and RAG technology. Upload documents,
            ask questions, and get intelligent responses with tool integration.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-6">
            <Link href="/chat">
              <HoverBorderGradient
                containerClassName="rounded-full"
                as="button"
                className="dark:bg-black bg-white text-black dark:text-white flex items-center space-x-2"
              >
                <span>Get Started</span>
              </HoverBorderGradient>
            </Link>
            <Link href="/docs">
              <button className="px-8 py-2 rounded-full bg-transparent border border-white/20 text-white text-sm hover:bg-white/10 transition duration-200">
                Learn More
              </button>
            </Link>
          </div>
        </Vortex>
      </div>

      {/* Features: Infinite Moving Cards */}
      <div className="h-[25rem] rounded-md flex flex-col antialiased bg-black dark:bg-black dark:bg-grid-white/[0.05] items-center justify-center relative overflow-hidden">
        <h2 className="text-3xl font-bold text-white mb-10 z-10">Powerful Features</h2>
        <InfiniteMovingCards
          items={features}
          direction="right"
          speed="slow"
        />
      </div>

      {/* Evervault Cards Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-16">Security First</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 ">
            <div className="border border-white/[0.2] flex flex-col items-start max-w-sm mx-auto p-4 relative h-[30rem]">
              <Icon className="absolute h-6 w-6 -top-3 -left-3 dark:text-white text-black" />
              <Icon className="absolute h-6 w-6 -bottom-3 -left-3 dark:text-white text-black" />
              <Icon className="absolute h-6 w-6 -top-3 -right-3 dark:text-white text-black" />
              <Icon className="absolute h-6 w-6 -bottom-3 -right-3 dark:text-white text-black" />

              <EvervaultCard text="Encrypted" />

              <h2 className="dark:text-white text-black mt-4 text-sm font-light">
                End-to-end encryption for all your data.
              </h2>
            </div>
            <div className="border border-white/[0.2] flex flex-col items-start max-w-sm mx-auto p-4 relative h-[30rem]">
              <Icon className="absolute h-6 w-6 -top-3 -left-3 dark:text-white text-black" />
              <Icon className="absolute h-6 w-6 -bottom-3 -left-3 dark:text-white text-black" />
              <Icon className="absolute h-6 w-6 -top-3 -right-3 dark:text-white text-black" />
              <Icon className="absolute h-6 w-6 -bottom-3 -right-3 dark:text-white text-black" />

              <EvervaultCard text="Private" />

              <h2 className="dark:text-white text-black mt-4 text-sm font-light">
                Isolated sessions and secure storage.
              </h2>
            </div>
            <div className="border border-white/[0.2] flex flex-col items-start max-w-sm mx-auto p-4 relative h-[30rem]">
              <Icon className="absolute h-6 w-6 -top-3 -left-3 dark:text-white text-black" />
              <Icon className="absolute h-6 w-6 -bottom-3 -left-3 dark:text-white text-black" />
              <Icon className="absolute h-6 w-6 -top-3 -right-3 dark:text-white text-black" />
              <Icon className="absolute h-6 w-6 -bottom-3 -right-3 dark:text-white text-black" />

              <EvervaultCard text="Secure" />

              <h2 className="dark:text-white text-black mt-4 text-sm font-light">
                Enterprise-grade security standards.
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-black border-t border-white/10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: "How does the RAG technology work?",
                a: "Our RAG (Retrieval-Augmented Generation) system indexes your uploaded documents and retrieves relevant context to answer your questions accurately."
              },
              {
                q: "Is my data secure?",
                a: "Yes. We use industry-standard encryption and ensure that your data is isolated from other users."
              },
              {
                q: "Can I use custom tools?",
                a: "Absolutely. Our agent supports MCP (Model Context Protocol), allowing you to integrate custom tools and APIs easily."
              }
            ].map((faq, i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-gray-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10 bg-black">
        <div className="max-w-7xl mx-auto text-center text-gray-500">
          <p>© 2024 DosiBridge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
