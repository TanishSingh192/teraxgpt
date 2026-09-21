# Refine Multiform into a familiar AI chat interface

## Goal
Make the workspace feel immediately recognizable to ChatGPT and Claude users while retaining Multiform’s model routing, files, history, and usage features.

## Changes
- Simplify the left rail into a quiet conversation sidebar with a compact brand row, prominent new-chat action, search, recent chats, and a restrained account menu.
- Remove the permanent right context panel so the conversation becomes the clear focus; surface model, routing, and usage details inline only when useful.
- Replace the dashboard-like chat header with a minimal model picker and compact utility actions.
- Rework the empty state around a centered greeting and large composer, followed by a small set of starter prompts.
- Restyle active conversations as spacious, readable turns: user messages in subtle bubbles and assistant answers as clean document-like text.
- Create a floating, rounded composer with attachment and send controls, Enter-to-send behavior, and a short disclaimer below.
- Add a mobile sidebar trigger and keep the interface usable at narrow widths.

## Visual direction
A warm white canvas, neutral charcoal text, soft gray sidebar, minimal borders, and restrained blue accents. Typography and spacing will prioritize reading and writing over dashboard density.

## Technical notes
- Keep the existing authentication, streaming, model selection, conversation persistence, uploads, and usage tracking unchanged.
- Limit changes to the workspace presentation and interaction layer.
- Verify the signed-out screen and authenticated layout at desktop and mobile widths.
