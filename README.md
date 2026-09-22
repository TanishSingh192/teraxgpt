# Unified AI Workspace

Product Requirements Document (PRD)

Product: Unified Multimodal AI Platform

Document version: 1.0
Status: Product Definition
Target platforms: Web, mobile web, desktop, eventually native mobile
Primary concept: One AI workspace that provides access to multiple leading AI models, multimodal interaction, files, web research, coding, agents, memory, projects, and extensible tools through a unified interface.

1. Executive Summary

The product is a unified AI platform that brings together multiple AI model providers—including OpenAI, Anthropic, Google, and potentially additional providers—behind a single application.

The goal is not simply to create another chatbot.

The goal is to create an AI workspace where users can:

Chat with multiple AI models.

Upload and analyze documents, images, audio, and other files.

Have natural voice conversations.

Search the web.

Generate and analyze images.

Write, debug, and execute code.

Perform data analysis.

Create projects and maintain persistent context.

Build and use AI agents.

Connect external services.

Compare responses from multiple models.

Automatically route tasks to appropriate models.

Maintain memory and personalized context.

Run long-running tasks.

Collaborate with AI on documents and other artifacts.

The platform should abstract away the differences between individual AI providers.

Instead of users thinking:

"Should I use ChatGPT, Claude, or Gemini?"

the product should allow them to think:

"What do I want to accomplish?"

The platform determines which model, tools, and workflows are appropriate.

2. Product Vision

Vision

Create a single AI environment that acts as the user's:

conversational assistant

researcher

programmer

analyst

writing partner

document assistant

multimodal assistant

personal knowledge system

automation layer

AI agent platform

The user should not need to understand model providers, APIs, context windows, tool protocols, or model-specific interfaces.

3. Product Principles

3.1 Model agnostic

The application must not be fundamentally dependent on a single model provider.

Models should be interchangeable through an abstraction layer.

3.2 Capability first

Users should primarily interact with capabilities rather than APIs.

For example:

Research
Coding
Analyze file
Create image
Analyze image
Voice
Data analysis
Build agent


rather than:

GPT-X
Claude-X
Gemini-X


Advanced users may still choose models manually.

3.3 Multimodal by default

Text should not be the only input mechanism.

Users should be able to combine:

Text
+
Images
+
Documents
+
Audio
+
Video
+
Structured data


within the same task where supported.

3.4 Persistent context

The application should understand:

current conversation

project context

uploaded files

user preferences

relevant memories

previous work

without requiring users to repeatedly provide the same information.

3.5 Tool-oriented architecture

Models should be able to use tools rather than only generate text.

Examples:

Search web
Read file
Write file
Run Python
Execute code
Query database
Browse website
Call API
Generate image
Send email
Create document


4. Target Users

4.1 General users

People who want one AI assistant for everyday tasks.

Typical activities:

questions

writing

summarization

planning

image analysis

document analysis

research

4.2 Students

Use cases:

learning

studying PDFs

solving problems

creating study plans

analyzing notes

generating quizzes

tutoring

4.3 Developers

Use cases:

coding

debugging

code review

architecture

repository analysis

terminal execution

documentation

API development

4.4 Researchers

Use cases:

web research

literature analysis

document comparison

data analysis

multi-source synthesis

4.5 Professionals

Use cases:

presentations

reports

spreadsheets

emails

meetings

business research

data analysis

4.6 Power users

Use cases:

model comparison

agents

workflows

automations

custom tools

APIs

custom assistants

5. Product Scope

Phase 1 — Core AI Workspace

The MVP should provide:

Authentication

Chat

Multiple models

Streaming responses

Conversation history

File uploads

Image understanding

Document analysis

Model selection

Basic model routing

Web search

Markdown/code rendering

Usage tracking

Basic settings

6. Phase 2 — Multimodal Workspace

Add:

Voice input

Voice output

Image generation

Audio processing

Video understanding where supported

Advanced file handling

Data analysis

Python execution

Interactive artifacts

Projects

7. Phase 3 — AI Agents

Add:

Agent creation

Tool selection

Web browsing

Computer/browser automation

Long-running tasks

Scheduled tasks

Background execution

Agent memory

Agent permissions

Agent logs

8. Phase 4 — Advanced Platform

Add:

Custom models

Local models

Enterprise workspaces

Team collaboration

Custom connectors

API access

Developer SDK

Workflow builder

Marketplace

Custom agents

Advanced analytics

9. Core User Experience

9.1 Main screen

The default interface should contain:

┌─────────────────────────────────────────────┐
│ Logo       Search       Projects    Profile │
├──────────────┬──────────────────────────────┤
│              │                              │
│ New Chat     │                              │
│              │       Conversation           │
│ Chats        │                              │
│              │                              │
│ Projects     │                              │
│              │                              │
│ Agents       │                              │
│              │                              │
│ Files        │                              │
│              │                              │
│ Settings     │                              │
│              │                              │
├──────────────┴──────────────────────────────┤
│ 📎  🎤  +     Ask anything...          ➤   │
│                                              │
│ Model: Auto                                  │
└─────────────────────────────────────────────┘


10. Chat System

Requirements

The chat system must support:

text

markdown

code blocks

syntax highlighting

tables

citations

images

files

audio

video where supported

generated artifacts

tool execution indicators

streaming responses

regeneration

editing messages

branching conversations

message feedback

11. Model Abstraction Layer

This is one of the most important components.

The frontend must NOT directly integrate every provider.

Instead:

Frontend
   ↓
AI Gateway
   ↓
Provider abstraction
   ↓
OpenAI
Anthropic
Google
Other providers


Example internal interface:

interface AIProvider {
  generate(request: AIRequest): Promise<AIResponse>;

  stream(request: AIRequest): AsyncIterable<AIChunk>;

  analyzeImage(request: ImageRequest): Promise<AIResponse>;

  analyzeFile(request: FileRequest): Promise<AIResponse>;

  generateImage(request: ImageGenerationRequest): Promise<ImageResponse>;

  transcribe(request: AudioRequest): Promise<Transcript>;

  textToSpeech(request: TTSRequest): Promise<AudioResponse>;
}


Each provider adapter implements this interface.

12. Model Registry

Create a centralized model registry.

Example:

{
  "model_id": "provider-model-id",
  "provider": "provider",
  "capabilities": [
    "text",
    "vision",
    "reasoning",
    "tools"
  ],
  "context_window": 100000,
  "supports_streaming": true,
  "supports_tools": true,
  "input_modalities": [
    "text",
    "image",
    "file"
  ],
  "output_modalities": [
    "text"
  ]
}


This allows the application to determine what a model can actually do.

13. Automatic Model Routing

The user should be able to select:

Auto


When Auto is selected, the routing engine evaluates the request.

Example:

User request
     ↓
Task classifier
     ↓
┌─────────────────────────┐
│ What does this require? │
└─────────────────────────┘
     ↓
Research
Coding
Vision
Reasoning
Writing
Large context
Voice
Image generation
     ↓
Model selection


Routing factors should include:

task type

required modality

context size

latency requirements

cost

model availability

user preferences

reliability

tool requirements

The system must not claim a model was used if it wasn't.

14. Model Comparison

Power users should be able to request:

Compare Models


Example:

                Response comparison

GPT              Claude             Gemini

Response         Response           Response
...

[Use this response]


The application should clearly identify which model generated each response.

15. File System

Users should be able to upload:

PDF

DOCX

XLSX

CSV

TXT

Markdown

images

audio

video where supported

source code

ZIP/project archives where appropriate

The system should:

Validate file.

Scan file.

Extract metadata.

Extract text/content.

Generate embeddings where appropriate.

Store processed representation.

Make content available to the AI system.

16. Document Intelligence

Users should be able to ask:

Summarize this PDF.

Or:

Compare these three documents.

Or:

Find every mention of "termination clause."

Or:

Extract all financial numbers into a table.

The system should support:

Document
   ↓
Parser
   ↓
Content extraction
   ↓
Chunking
   ↓
Indexing
   ↓
Retrieval
   ↓
Model


For large files, use retrieval rather than sending the entire file to the model repeatedly.

17. Image Understanding

Users should be able to:

upload an image

ask questions about it

extract text

analyze charts

analyze screenshots

identify objects

compare images

reason about diagrams

Example:

Upload screenshot

"What is wrong with this UI?"


The system should send the image to a compatible vision model.

18. Image Generation

The platform should expose image generation as a capability rather than tying it to one provider.

Example:

Create an image
      ↓
Image generation router
      ↓
Available image model


Features:

prompt generation

aspect ratio

image editing

image variations

reference images

transparent backgrounds where supported

19. Voice System

Voice architecture:

Microphone
    ↓
Speech-to-text
    ↓
AI model
    ↓
Text response
    ↓
Text-to-speech
    ↓
Speaker


For realtime voice:

Microphone
    ⇅
Realtime connection
    ⇅
Realtime model
    ⇅
Speaker


Requirements:

interruption/barge-in

streaming audio

low latency

microphone permissions

audio controls

transcription

conversation history

20. Web Research

The platform should provide a research mode.

Example:

User question
      ↓
Research planner
      ↓
Search
      ↓
Open sources
      ↓
Extract information
      ↓
Cross-check
      ↓
Synthesize
      ↓
Citations


The system should clearly distinguish:

model-generated content

retrieved information

source citations

21. Coding Environment

Create a secure execution environment.

Possible architecture:

User
 ↓
AI
 ↓
Code generation
 ↓
Sandbox
 ↓
Python / Node / other runtimes
 ↓
Execution result
 ↓
AI
 ↓
Final response


The sandbox must be isolated from:

production databases

internal services

user secrets

host filesystem

unrestricted network access

Resource limits should include:

CPU

memory

execution time

disk

network

22. Data Analysis

Users should be able to upload:

CSV
XLSX
JSON
Parquet


and ask:

Analyze this dataset.

The system can use:

Python

pandas

NumPy

visualization libraries

SQL

statistical tools

The AI should be able to generate:

tables

charts

statistical summaries

cleaned datasets

downloadable outputs

23. Artifacts

The platform should allow AI to produce usable outputs rather than only text.

Examples:

Documents
Spreadsheets
Presentations
Charts
Code
HTML
Markdown
Reports
Data files
Images


The user should be able to:

preview

edit

download

regenerate

continue working on the artifact

24. Projects

A project should contain:

Project
├── Instructions
├── Conversations
├── Files
├── Knowledge
├── Agents
├── Artifacts
└── Settings


Example:

Project: Startup

Files:
- business-plan.pdf
- financials.xlsx
- pitch-deck.pptx

Instructions:
"You are helping me build this company."

Chats:
- Market research
- Financial analysis
- Pitch deck


The AI can use project context when answering.

25. Memory

Memory should have multiple layers.

Short-term memory

Current conversation.

Project memory

Information relevant to a project.

User memory

Stable user preferences that the user has permitted the application to retain.

Retrieved memory

Information dynamically retrieved when relevant.

Architecture:

User
 ↓
Request
 ↓
Memory retrieval
 ↓
Relevant context
 ↓
Model


Memory should be:

transparent

controllable

editable

deletable

scoped appropriately

26. Agent System

An agent is an AI system capable of planning and using tools.

Example:

Goal
 ↓
Planner
 ↓
Choose tool
 ↓
Execute
 ↓
Observe result
 ↓
Reason
 ↓
Choose next action
 ↓
...
 ↓
Final result


Tools could include:

Web search
Browser
Python
Database
Filesystem
Email
Calendar
API
Image generation
Document creation


27. Agent Permissions

Agents must never receive unlimited access by default.

Permissions should be explicit:

Agent permissions

☑ Read uploaded files
☑ Search web
☑ Run Python
☐ Send emails
☐ Delete files
☐ Make purchases
☐ Modify external systems


High-risk actions should require confirmation.

28. Browser / Computer Automation

A computer-use system can be built around a sandboxed browser/computer environment.

Architecture:

Agent
 ↓
Browser controller
 ↓
Browser sandbox
 ↓
Website
 ↓
Screenshot/state
 ↓
Agent


The agent can:

click

type

navigate

inspect pages

download files

upload files

Actions affecting external systems should have appropriate authorization and confirmation.

29. Connectors

Eventually support:

Google Drive
Dropbox
OneDrive
Notion
Slack
GitHub
Gmail
Calendar
Linear
Jira
Databases
Custom APIs


Connector architecture:

AI
 ↓
Connector interface
 ↓
OAuth
 ↓
External service


Users should explicitly authorize access.

30. Authentication

Support:

email/password

Google login

Apple login

OAuth

passkeys

Each user should have:

User
├── Profile
├── Conversations
├── Projects
├── Files
├── Agents
├── Memories
├── Usage
└── Billing


31. Billing

Because different providers have different pricing, usage tracking is essential.

Track:

User
 ↓
Request
 ↓
Provider
 ↓
Model
 ↓
Input tokens
 ↓
Output tokens
 ↓
Tool usage
 ↓
Cost


The system should maintain an internal normalized usage record.

Example:

{
  "user_id": "...",
  "provider": "provider",
  "model": "model",
  "input_tokens": 12000,
  "output_tokens": 2500,
  "estimated_cost": 0.12
}


32. Subscription Architecture

Possible plans:

Free

limited messages

limited file uploads

limited model access

Pro

higher limits

advanced models

advanced tools

larger files

agents

Team

shared projects

administration

team billing

collaboration

Enterprise

SSO

audit logs

custom retention

enterprise connectors

dedicated infrastructure

advanced security controls

33. Backend Architecture

Recommended architecture:

                    CDN
                     │
                     ▼
                 Frontend
                     │
                     ▼
                 API Gateway
                     │
       ┌─────────────┼──────────────┐
       ▼             ▼              ▼
   Auth Service   Chat Service   File Service
       │             │              │
       └─────────────┼──────────────┘
                     ▼
                AI Gateway
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       OpenAI     Anthropic   Google
                     │
                     ▼
               Tool Runtime
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
     Search       Python       Browser


34. Recommended Infrastructure

A possible stack:

Frontend

Next.js
React
TypeScript
Tailwind CSS


Backend

Node.js / TypeScript


or:

Python
FastAPI


Database

PostgreSQL


Cache

Redis


Object storage

S3-compatible storage


Vector search

Potentially:

pgvector


or a dedicated vector database.

Queues

Redis / Kafka / managed queue


Realtime

WebSockets
SSE
WebRTC where appropriate


Observability

OpenTelemetry
Logs
Metrics
Tracing
Error monitoring


35. Data Model

Core entities:

User
Organization
Conversation
Message
Attachment
Project
ProjectFile
Memory
Model
Provider
Tool
Agent
AgentRun
Artifact
UsageRecord
Subscription
Connector
APIKey


Relationship example:

User
 ├── Conversations
 ├── Projects
 │    ├── Files
 │    ├── Agents
 │    └── Artifacts
 ├── Memories
 └── Usage


36. Message Model

A message should not simply be:

{
  "text": "hello"
}


Instead, use a structured content model.

Example:

{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "Analyze this image"
    },
    {
      "type": "image",
      "attachment_id": "abc123"
    }
  ]
}


This allows future multimodal expansion without redesigning the database.

37. Tool Interface

All tools should expose a standardized interface.

Example:

interface Tool {
  id: string;
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}


This makes tools provider-independent.

38. Security

Security should be treated as a core product feature.

Requirements:

encryption in transit

encryption at rest

secure authentication

OAuth token encryption

secret management

tenant isolation

access control

audit logging

rate limiting

abuse prevention

file scanning

sandboxed execution

prompt-injection defenses

SSRF protection

network restrictions

secure deletion

configurable data retention

39. Prompt Injection Protection

This is particularly important for:

Web browsing
Files
Emails
External connectors
Agents


Example:

A PDF could contain instructions attempting to manipulate the AI.

The system must distinguish:

DATA


from:

INSTRUCTIONS


and tools must enforce permissions independently of model-generated instructions.

40. API Key Security

Provider API keys should never be exposed to the frontend.

Correct:

Frontend
   ↓
Your backend
   ↓
Provider API


Incorrect:

Frontend
   ↓
OpenAI API key


Provider credentials should remain server-side.

41. Reliability

The platform should handle:

provider downtime

rate limits

timeouts

malformed responses

unavailable models

network failures

partial streaming

tool failures

Example:

Provider A unavailable
        ↓
AI Gateway detects failure
        ↓
Provider B
        ↓
Continue request


Fallback behavior must respect capability requirements; a vision request shouldn't silently fall back to a text-only model.

42. Observability

Every request should have a trace ID.

Example:

Request
  │
  ├── Router
  ├── Model
  ├── Tool
  ├── Search
  ├── Database
  └── Response


Track:

latency

tokens

cost

errors

model

tool calls

user feedback

provider response status

43. Admin Dashboard

Admins should be able to see:

Users
Revenue
Usage
Models
Provider costs
Errors
Latency
Storage
Agents
Tool usage
Abuse


Example:

Today's usage

OpenAI      $1,240
Anthropic     $840
Google        $510
Tools         $120

Total       $2,710


44. Evaluation System

You should not rely only on user feedback.

Create an internal evaluation framework.

Test:

Reasoning
Coding
Vision
Document analysis
Tool use
Research
Long context
Instruction following
Safety
Latency
Cost


Store evaluation results per model and task type.

This can inform routing without hard-coding assumptions about which provider is always best.

45. Model Router v2

Eventually the router can learn from historical data.

Example:

Request
 ↓
Task classifier
 ↓
Candidate models
 ↓
Cost / latency / capability constraints
 ↓
Model selection
 ↓
Response
 ↓
User feedback
 ↓
Evaluation data
 ↓
Router improvement


The router should remain configurable rather than becoming an opaque system that cannot be audited.

46. Frontend Components

Build reusable components:

ChatWindow
Message
MessageComposer
FileUploader
ImagePreview
AudioRecorder
VoicePlayer
ModelSelector
ModelComparison
ToolExecution
Citation
CodeBlock
CodeEditor
ArtifactViewer
DataTable
Chart
ProjectSidebar
AgentPanel
SettingsPanel
UsageDashboard


47. Mobile UX

Mobile should prioritize:

Chat
Voice
Camera
File upload
Image analysis
Quick actions


A user should be able to:

Open app
 ↓
Tap camera
 ↓
Take photo
 ↓
Ask question
 ↓
Receive response


48. Performance Requirements

Target:

Chat

Time to first token:

< 2 seconds


where provider latency permits.

UI

Initial application load:

< 3 seconds


on a reasonable connection.

File upload

Upload progress must be displayed.

Streaming

Responses should stream rather than waiting for complete generation.

49. Privacy

Users should be able to understand:

what data is stored

how long it is stored

which providers receive requests

which connectors are authorized

what memory exists

how to delete data

Sensitive provider credentials should never be exposed to models unnecessarily.

50. MVP Definition

The first release should NOT attempt to implement everything.

Build:

Authentication
        ↓
Chat
        ↓
OpenAI + Anthropic + Google integration
        ↓
Model selector
        ↓
Streaming
        ↓
Conversation history
        ↓
File upload
        ↓
Image understanding
        ↓
Basic web search
        ↓
Usage tracking


Then add:

Projects
 ↓
Memory
 ↓
Voice
 ↓
Data analysis
 ↓
Artifacts
 ↓
Agents


51. Development Roadmap

Stage 1 — Foundation

Build:

authentication

database

frontend shell

backend API

AI gateway

provider adapters

streaming

conversation storage

Stage 2 — Multimodal

Add:

image input

file uploads

PDFs

document processing

image generation

voice

Stage 3 — Tools

Add:

web search

Python

data analysis

code execution

artifacts

Stage 4 — Projects

Add:

project context

project files

project instructions

project memory

Stage 5 — Agents

Add:

planning

tools

permissions

browser

background jobs

scheduled tasks

Stage 6 — Platform

Add:

connectors

teams

enterprise

API

SDK

custom agents

custom models

52. Critical Architectural Decision

The most important architectural decision is:

Do not build the application around one provider.

Bad:

Frontend
   ↓
OpenAI


Better:

Frontend
   ↓
Your AI Gateway
   ↓
Provider abstraction
   ├── OpenAI
   ├── Anthropic
   ├── Google
   ├── Other providers
   └── Local models


Then your application survives provider changes.

53. Example End-to-End Request

User says:

"Analyze this financial PDF, search the web for the company's latest information, compare it with the numbers in the PDF, and make me a report."

The system could execute:

User request
     ↓
Intent detection
     ↓
Project context
     ↓
Read PDF
     ↓
Extract financial data
     ↓
Web research
     ↓
Collect sources
     ↓
Analyze data
     ↓
Reasoning model
     ↓
Generate report
     ↓
Create artifact
     ↓
Show citations
     ↓
Save to project


The user experiences this as one conversation, even though many backend services may have participated.

54. Example Advanced Request

User:

"Research electric vehicle companies, analyze these 5 reports, make charts from the financial data, create a presentation, and give me a 10-minute voice briefing."

Your platform could orchestrate:

             USER
               │
               ▼
             AGENT
               │
       ┌───────┼────────┐
       ▼       ▼        ▼
     Files    Web      Data
       │       │        │
       └───────┼────────┘
               ▼
            Analysis
               │
       ┌───────┼────────┐
       ▼       ▼        ▼
     Charts   Report   Slides
               │
               ▼
          Voice briefing


This is the type of architecture that gets you from "AI chatbot" to an actual AI workspace/platform.

55. Success Metrics

Product

Daily active users

Weekly active users

Conversations per user

Tasks completed

Files analyzed

Projects created

Agents created

Quality

Task success rate

User satisfaction

Tool success rate

Hallucination/error rate

Citation correctness

Performance

Time to first token

End-to-end latency

Tool latency

Error rate

Economics

AI cost/user

Infrastructure cost/user

Revenue/user

Gross margin

Cost per completed task

56. Final Product Definition

The final product should feel like:

                  ┌─────────────────────┐
                  │      YOUR AI        │
                  │      WORKSPACE      │
                  └──────────┬──────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   CONVERSATION           PROJECTS             AGENTS
        │                    │                    │
        ▼                    ▼                    ▼
     Models               Files                Tools
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
                       AI ORCHESTRATOR
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
       OpenAI             Anthropic           Google
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                             ▼
                    External Tool Layer
                             │
       ┌─────────┬───────────┼──────────┬───────────┐
       ▼         ▼           ▼          ▼           ▼
     Search    Python     Browser    Files       APIs


The core strategic idea is:

Don't try to clone three applications independently. Build one platform with a common AI abstraction layer, then expose the capabilities of multiple providers through that platform.

That gives you the flexibility to add new models and capabilities without redesigning the entire product.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://teraxgpt.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8659d2dc-e27d-4b16-9588-5b3925b51a3a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
