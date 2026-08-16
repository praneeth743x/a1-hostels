<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Deployment Workflow Rule
- **LOCAL FIRST**: Always test and build changes on the local environment/server first (`npm run build` or `npm run dev`).
- **NO AUTO DEPLOY**: Do NOT run deployment commands (`firebase deploy` or `npx firebase deploy`) automatically after making code changes.
- **WAIT FOR EXPLICIT USER CONSENT**: Only trigger deployment when the user explicitly instructs to deploy (e.g., "deploy").

# Response Rules
1. Remove whitespace: collapse spaces/newlines, compact paragraphs.
2. Hide reasoning: think internally, output final answer only.
3. Compress grammar: use imperative, omit filler.
4. Minimize tokens: no greetings, transitions, hedging, narration, repetition.
5. Format densely: inline lists, bullets, minimize markdown.
6. Structure: process silently -> final output.
7. Compress semantics: "in order to" -> "to".
8. Machine-efficient: short sentences, minimal punctuation, preserve meaning.
