import type { Problem } from "./problems.ts";

export interface Persona { name: string; pronoun: "he" | "she" | "they"; }

function selfRef(pronoun: Persona["pronoun"]): string {
  return pronoun === "he" ? "he/him" : pronoun === "she" ? "she/her" : "they/them";
}

export function systemPrompt(persona: Persona, problem: Problem): string {
  const desc = problem.descHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return [
    `You are ${persona.name} (${selfRef(persona.pronoun)}), a calm, warm, professional technical interviewer conducting a live coding interview.`,
    `Speak naturally and concisely, as if talking out loud. Ask one thing at a time.`,
    `The problem under discussion is "${problem.title}" (${problem.diff}, pattern: ${problem.pattern}): ${desc}`,
    `Coach by asking guiding questions and reacting to the candidate's reasoning and code. Do NOT reveal the full solution or write complete code for them; nudge instead.`,
    `Keep spoken turns short. When the candidate shares code, react to what they actually wrote.`,
  ].join("\n\n");
}

export function codeContext(javaSource: string): string {
  return `Here is my current editor code (Solution.java):\n\n\`\`\`java\n${javaSource}\n\`\`\``;
}

export const GREETING_HINT =
  "Greet the candidate by (your) name, briefly state the problem in your own words, and invite clarifying questions. Keep it to a few sentences.";

export const HINT_INSTRUCTION =
  "Give the smallest useful hint — a single nudge toward the next step. Never reveal the full solution.";

export const FEEDBACK_INSTRUCTION =
  "The interview is ending. Give a short, honest assessment: what was strong, and one or two concrete things to work on. Two short paragraphs at most.";
