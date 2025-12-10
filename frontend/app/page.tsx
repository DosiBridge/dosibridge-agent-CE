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
import { IconHome, IconInfoCircle, IconMail, IconFileText, IconBrandGithub } from "@tabler/icons-react";
import Link from "next/link";

import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";

export default function Home() {
  const { user, isAuthenticated } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    {
      name: "Home",
      link: "/",
      icon: <IconHome className="h-4 w-4 text-neutral-500 dark:text-white" />,
    },
    {
      name: "About",
      link: "#about",
      icon: <IconInfoCircle className="h-4 w-4 text-neutral-500 dark:text-white" />,
    },
    {
      name: "Features",
      link: "#features",
      icon: <IconFileText className="h-4 w-4 text-neutral-500 dark:text-white" />,
    },
    {
      name: "Docs",
      link: "/docs",
      icon: <IconFileText className="h-4 w-4 text-neutral-500 dark:text-white" />,
    },
    {
      name: "Contact",
      link: "#contact",
      icon: <IconMail className="h-4 w-4 text-neutral-500 dark:text-white" />,
    },
    ...(mounted && isAuthenticated && user?.role === 'superadmin' ? [{
      name: "Dashboard",
      link: "/admin",
      icon: <IconBrandGithub className="h-4 w-4 text-neutral-500 dark:text-white" />, // Using Github icon as placeholder, or could import LayoutDashboard
    }] : []),
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
      <div className="w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] mx-auto rounded-md h-[30rem] sm:h-[35rem] md:h-[40rem] overflow-hidden mt-20 sm:mt-0">
        <Vortex
          backgroundColor="black"
          className="flex items-center flex-col justify-center px-4 sm:px-6 md:px-10 py-6 sm:py-4 w-full h-full"
        >
          <h2 className="text-white text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center px-2">
            Your <FlipWords words={words} /> <br /> AI Assistant
          </h2>
          <div className="flex items-center justify-center gap-2 mt-3 sm:mt-4">
            <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs sm:text-sm font-medium">
              🟢 Fully Open Source
            </span>
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs sm:text-sm font-medium">
              MIT License
            </span>
          </div>
          <p className="text-white text-sm sm:text-base md:text-xl lg:text-2xl max-w-xl mt-4 sm:mt-6 text-center px-4">
            Powered by advanced AI agents and RAG technology. Upload documents,
            ask questions, and get intelligent responses with tool integration.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mt-4 sm:mt-6 px-4">
            <Link href="/chat" className="w-full sm:w-auto">
              <HoverBorderGradient
                containerClassName="rounded-full w-full sm:w-auto"
                as="button"
                className="dark:bg-black bg-white text-black dark:text-white flex items-center justify-center space-x-2 w-full sm:w-auto px-6 py-2.5 sm:py-2"
              >
                <span className="text-sm sm:text-base">Get Started</span>
              </HoverBorderGradient>
            </Link>
            <Link href="/docs" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-2 rounded-full bg-transparent border border-white/20 text-white text-sm sm:text-base hover:bg-white/10 transition duration-200">
                Learn More
              </button>
            </Link>
          </div>
        </Vortex>
      </div>

      {/* Features: Infinite Moving Cards */}
      <section id="features" className="h-[20rem] sm:h-[25rem] rounded-md flex flex-col antialiased bg-black dark:bg-black dark:bg-grid-white/[0.05] items-center justify-center relative overflow-hidden px-4 py-8 sm:py-0">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-10 z-10 text-center px-4">Powerful Features</h2>
        <InfiniteMovingCards
          items={features}
          direction="right"
          speed="slow"
        />
      </section>

      {/* Evervault Cards Section */}
      <div className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-8 sm:mb-12 md:mb-16">Security First</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
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

      {/* Tech Stack Marquee */}
      <div className="py-8 sm:py-10 bg-black flex flex-col items-center justify-center overflow-hidden px-4">
        <h3 className="text-gray-500 text-xs sm:text-sm uppercase tracking-widest mb-4 sm:mb-6 text-center">Powered by modern technology stack</h3>
        <InfiniteMovingCards
          items={[
            { quote: "State-of-the-art LLMs", name: "OpenAI GPT-4", title: "Core Intelligence" },
            { quote: "Vector Embeddings", name: "Pinecone", title: "Knowledge Base" },
            { quote: "Agent Orchestration", name: "LangChain", title: "Workflow Engine" },
            { quote: "Frontend Framework", name: "Next.js 14", title: "React Framework" },
            { quote: "Backend API", name: "FastAPI", title: "Python Server" },
            { quote: "Real-time Events", name: "WebSockets", title: "Live Streaming" },
          ]}
          direction="left"
          speed="slow"
          className="bg-transparent"
        />
      </div>

      {/* Use Cases Section */}
      <section className="py-12 sm:py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-black relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-white px-4">Versatile Use Cases</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base px-4">
              From coding assistance to legal research, DosiBridge Agent adapts to your specific professional needs.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { title: "Technical Support", desc: "Automate responses to complex technical queries using documentation." },
              { title: "Legal Research", desc: "Analyze contracts and legal documents to extract key clauses instantly." },
              { title: "Market Analysis", desc: "Synthesize reports from multiple market research PDFs and articles." },
              { title: "Code Assistant", desc: "Explain complex codebases and generate documentation automatically." }
            ].map((useCase, i) => (
              <div key={i} className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:border-indigo-500/50 transition-colors group">
                <div className="h-2 w-2 rounded-full bg-indigo-500 mb-4 group-hover:scale-150 transition-transform"></div>
                <h3 className="text-lg font-bold text-white mb-2">{useCase.title}</h3>
                <p className="text-sm text-gray-400">{useCase.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-12 sm:py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-black border-t border-white/10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
              <span className="px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-semibold">
                🟢 Fully Open Source
              </span>
              <span className="px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-sm font-semibold">
                MIT License
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 sm:mb-6 px-4">About DosiBridge Agent</h2>
          </div>
          <div className="space-y-4 sm:space-y-6 text-gray-300 leading-relaxed px-4">
            <p className="text-base sm:text-lg">
              DosiBridge Agent is a <strong className="text-white">fully open-source</strong> AI-powered assistant built by <a href="https://dosibridge.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">DosiBridge</a>, designed to help businesses and individuals leverage the power of artificial intelligence for enhanced productivity and intelligent automation.
            </p>
            <p className="text-base sm:text-lg font-semibold text-white">
              🎉 This project is completely open source and released under the MIT License. You are free to use, modify, and distribute it as you wish.
            </p>
            <p>
              Our platform combines cutting-edge RAG (Retrieval-Augmented Generation) technology with powerful agent capabilities, allowing you to upload documents, ask complex questions, and get intelligent responses backed by your own knowledge base.
            </p>
            <p>
              Built with enterprise-grade security and privacy in mind, DosiBridge Agent ensures your data remains encrypted and isolated, giving you complete control over your information.
            </p>
            <div className="mt-8 p-6 bg-white/5 rounded-2xl border border-white/10">
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium">
                  🟢 Fully Open Source
                </span>
                <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-medium">
                  MIT License
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-3 text-center">Powered by</p>
              <a href="https://dosibridge.com" target="_blank" rel="noopener noreferrer" className="text-xl font-bold text-white hover:text-indigo-400 transition-colors inline-flex items-center gap-2 mb-4 block mx-auto justify-center">
                dosibridge.com
                <IconBrandGithub className="w-5 h-5 opacity-70" />
              </a>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-3 border-t border-white/10">
                <a
                  href="https://github.com/DosiBridge/agent-tool"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-sm text-white group"
                >
                  <IconBrandGithub className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="font-medium">Star on GitHub</span>
                  <svg className="w-4 h-4 text-yellow-400 fill-yellow-400" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </a>
                <p className="text-xs text-gray-400 sm:ml-auto">Fully open source • MIT License</p>
              </div>
              <p className="text-sm text-gray-400 mt-3 text-center">This project is completely open source. Visit our main website to learn more about our services and solutions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <div className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8 bg-black border-t border-white/10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-8 sm:mb-12 px-4">Frequently Asked Questions</h2>
          <div className="space-y-4 sm:space-y-6">
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

      {/* Contact Section */}
      <section id="contact" className="py-12 sm:py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-black border-t border-white/10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center mb-8 sm:mb-12 px-4">Get in Touch</h2>
          <div className="space-y-4 sm:space-y-6 text-center px-4">
            <p className="text-base sm:text-lg text-gray-300">
              Have questions or need support? We're here to help.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-6 sm:mt-8">
              <a
                href="https://dosibridge.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm sm:text-base font-medium hover:from-indigo-700 hover:to-violet-700 transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
              >
                Visit dosibridge.com
              </a>
              <a
                href="mailto:contact@dosibridge.com"
                className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 rounded-full bg-transparent border border-white/20 text-white text-sm sm:text-base font-medium hover:bg-white/10 transition-all duration-200"
              >
                Contact Us
              </a>
            </div>
            <p className="text-sm text-gray-400 mt-8">
              DosiBridge Agent is powered by <a href="https://dosibridge.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">DosiBridge</a> - Your trusted partner for AI-powered solutions.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-4">
            <a
              href="https://github.com/DosiBridge/agent-tool"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-sm text-white group"
            >
              <IconBrandGithub className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Star on GitHub</span>
              <svg className="w-4 h-4 text-yellow-400 fill-yellow-400" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </a>
            <a
              href="https://dosibridge.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              dosibridge.com
            </a>
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium">
              🟢 Fully Open Source
            </span>
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-medium">
              MIT License
            </span>
          </div>
          <p className="text-center text-gray-500 text-sm">© {new Date().getFullYear()} DosiBridge. All rights reserved.</p>
          <p className="text-center text-gray-600 text-xs mt-2">This is a fully open source project released under the MIT License. Free to use, modify, and distribute.</p>
        </div>
      </footer>
    </div>
  );
}
