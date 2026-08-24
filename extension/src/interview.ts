import type { Msg } from "./openai.ts";
import type { Problem } from "./problems.ts";
import type { Persona } from "./prompt.ts";
import { systemPrompt, codeContext } from "./prompt.ts";

export class InterviewSession {
  private history: Msg[] = [];
  private readonly system: Msg;
  constructor(persona: Persona, public readonly problem: Problem) {
    this.system = { role: "system", content: systemPrompt(persona, problem) };
  }
  messages(): Msg[] { return [this.system, ...this.history]; }
  pushUser(text: string): void { this.history.push({ role: "user", content: text }); }
  pushAssistant(text: string): void { this.history.push({ role: "assistant", content: text }); }
  // Build the messages to send this turn: full history + a fresh user turn carrying code.
  turnMessages(userText: string, javaSource: string): Msg[] {
    const content = `${userText}\n\n${codeContext(javaSource)}`;
    return [...this.messages(), { role: "user", content }];
  }
}
